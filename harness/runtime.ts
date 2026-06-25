import { EventType, type Emit } from "@shared/event";
import { streamText, type JSONValue, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai"
import { SYSTEM_PROMPT } from "./system-prompt";
import { runTool, tools } from "./tools";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { emit } from "./bus";

const MAX_STEPS = 10

type ToolCall = {
    toolCallId: string,
    toolName: string,
    input: Record<string, unknown>
}

async function toolStep(tc: ToolCall, workflowId: string) {
    await emit({
        type: EventType.ToolRequested,
        workflowId,
        toolCallId: tc.toolCallId,
        name: tc.toolName,
        args: tc.input
    })

    const output = await runTool(tc.toolName, tc.input)

    await emit({
        type: EventType.ToolCompleted,
        workflowId,
        toolCallId: tc.toolCallId,
        result: output
    })

    return output
}

async function modelTurn(workflowId: string, messages: ModelMessage[]) {
    const result = streamText({
        model: openai("gpt-5-mini"),
        system: SYSTEM_PROMPT,
        messages: messages,
        tools
    })

    for await (const chunk of result.fullStream) {
        if (chunk.type === "text-delta") {
            await emit({ type: EventType.ModelDelta, workflowId, text: chunk.text })
        }
    }

    const rawCalls = await result.toolCalls

    return {
        text: await result.text,
        toolCalls: rawCalls.map(tc => ({
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            input: tc.input as Record<string, unknown>
        })),
        responseMessages: (await result.response).messages
    }

}

export async function agentWorkflow(input: string) {
    const workflowId = DBOS.workflowID ?? "unknown"
    await DBOS.runStep(() => emit({ type: EventType.WorkflowStarted, workflowId, input }), { name: "started" })


    const messages: ModelMessage[] = [
        { role: "user", content: input }
    ]

    let step = 0
    while (step < MAX_STEPS) {

        const turn = await DBOS.runStep(() => modelTurn(workflowId, messages), { name: `model-${step}` })


        messages.push(...turn.responseMessages)

        if (turn.toolCalls.length === 0) {
            await DBOS.runStep(
                () => emit({ type: EventType.ModelCompleted, workflowId, text: turn.text }),
                { name: `model-done-${step}` },
            );
            await DBOS.runStep(
                () => emit({ type: EventType.WorkflowCompleted, workflowId, output: turn.text }),
                { name: "completed" },
            );
            return turn.text;
        }


        for (const tc of turn.toolCalls) {
            const output = await DBOS.runStep(() => toolStep(tc, workflowId), { name: `tool-${tc.toolCallId}` })
            messages.push({
                role: "tool",
                content: [
                    {
                        type: "tool-result",
                        toolCallId: tc.toolCallId,
                        toolName: tc.toolName,
                        output: { type: "json", value: output as JSONValue }
                    }
                ]
            })
        }

        step++;
    }


    await DBOS.runStep(
        () =>
            emit({
                type: EventType.WorkflowFailed,
                workflowId,
                error: `Hit the ${MAX_STEPS}-step limit without finishing.`,
            }),
        { name: "failed" },
    );
    return "";
}

export const runAgentWorkflow = DBOS.registerWorkflow(agentWorkflow, {
    name: "agentWorkflow"
})