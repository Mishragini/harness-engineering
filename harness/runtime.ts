import { EventType, type Emit } from "@shared/event";
import { streamText, type ModelMessage } from "ai";
import { randomUUID } from "node:crypto";
import { openai } from "@ai-sdk/openai"
import { SYSTEM_PROMPT } from "./system-prompt";
import { tools } from "./tools";

const MAX_STEPS = 10

export async function runAgent({ input, emit }: { input: string, emit: Emit }) {
    const workflowId = randomUUID()
    emit({ type: EventType.WorkflowStarted, workflowId, input })

    const messages: ModelMessage[] = [
        { role: "user", content: input }
    ]

    let step = 0
    while (step < MAX_STEPS) {
        const result = streamText({
            model: openai("gpt-5-mini"),
            system: SYSTEM_PROMPT,
            messages: messages,
            tools
        })

        for await (const chunk of result.fullStream) {

            switch (chunk.type) {
                case "text-delta":
                    emit({ type: EventType.ModelDelta, workflowId, text: chunk.text })
                    break;
                case "tool-call":
                    emit({ type: EventType.ToolRequested, toolCallId: chunk.toolCallId, args: chunk.input, workflowId, name: chunk.toolName })
                    break;
                case "error":
                    emit({ type: EventType.WorkflowFailed, workflowId, error: String(chunk.error) })
                    break
                case "tool-result":
                    emit({ type: EventType.ToolCompleted, workflowId, toolCallId: chunk.toolCallId, result: chunk.output })
                    break
                default:
                    break;
            }

        }

        messages.push(...(await result.response).messages)

        const toolCalls = await result.toolCalls
        if (toolCalls.length === 0) {
            const text = await result.text
            emit({ type: EventType.ModelCompleted, workflowId, text })
            emit({ type: EventType.WorkflowCompleted, workflowId, output: text })
            return
        }

        step++;
    }

    emit({
        type: EventType.WorkflowFailed,
        workflowId,
        error: `Hit the ${MAX_STEPS}-step limit without finishing.`,
    });
}