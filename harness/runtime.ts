import { EventType } from "@shared/event";
import { streamText, type JSONValue, type ModelMessage, type ToolSet } from "ai";
import { openai } from "@ai-sdk/openai"
import { runTool } from "./tools";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { emit } from "./bus";
import { LLM_MODEL } from "../config";
import { buildContext, estimateTokens, KEEP_CONTEXT_TOKENS, MAX_CONTEXT_TOKENS, summarize } from "./memory";
import { agents, triageAgent } from "./agents";

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

function toolResultMessage(call: ToolCall, value: JSONValue): ModelMessage {
    return {
        role: "tool",
        content: [
            {
                type: "tool-result",
                toolCallId: call.toolCallId,
                toolName: call.toolName,
                output: {
                    type: "json",
                    value
                }
            }]
    }

}

async function modelTurn(agentTools: ToolSet, workflowId: string, messages: ModelMessage[]) {
    const result = streamText({
        model: openai(LLM_MODEL),
        messages: messages,
        tools: agentTools
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
    let currentAgent = triageAgent
    const workflowId = DBOS.workflowID ?? "unknown"
    await DBOS.runStep(() => emit({ type: EventType.WorkflowStarted, workflowId, input }), { name: "started" })


    const turns: ModelMessage[][] = []
    let summary = ""
    let step = 0
    while (step < MAX_STEPS) {

        if (estimateTokens(turns.flat()) > MAX_CONTEXT_TOKENS) {
            const old: ModelMessage[][] = []
            while (turns.length > 1 && estimateTokens(turns.flat()) > KEEP_CONTEXT_TOKENS) {
                const oldest = turns.shift()
                if (oldest) {
                    old.push(oldest)
                }
            }
            if (old.length > 0) {
                summary = await DBOS.runStep(() => summarize(old, summary), { name: `summarize-${step}` })
                const contextTokens = estimateTokens(buildContext(currentAgent.systemPrompt, input, summary, turns))

                await DBOS.runStep(() =>
                    emit({
                        type: EventType.MemoryCompacted,
                        workflowId,
                        summarizedTurns: old.length,
                        contextTokens,
                        summary
                    }),
                    { name: `compacted-${step}` }
                )
            }
        }

        const context = buildContext(currentAgent.systemPrompt, input, summary, turns)
        const turn = await DBOS.runStep(() => modelTurn(currentAgent.tools, workflowId, context), { name: `model-${step}` })


        const turnMessages: ModelMessage[] = [...turn.responseMessages]

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
            if (tc.toolName === "handoff") {
                const { to, reason } = tc.input as { to: string, reason: string }
                DBOS.runStep(
                    () =>
                        emit({
                            type: EventType.AgentHandoff,
                            workflowId,
                            to: String(to),
                            from: currentAgent.name,
                            reason: String(reason)
                        }),
                    { name: `handoff-${step}` }
                )
                currentAgent = agents[to] ?? currentAgent
                turnMessages.push(toolResultMessage(tc, { ok: true, handedOffTo: to }))
            } else {
                const output = await DBOS.runStep(() => toolStep(tc, workflowId), { name: `tool-${tc.toolCallId}` })
                turnMessages.push({
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

        }
        turns.push(turnMessages)
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