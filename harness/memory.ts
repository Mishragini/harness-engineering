import { openai } from "@ai-sdk/openai";
import { generateText, type ModelMessage } from "ai";
import { LLM_MODEL } from "../config";

export const MAX_CONTEXT_TOKENS = 500
export const KEEP_CONTEXT_TOKENS = 200

export function estimateTokens(messages: ModelMessage[]) {
    const chars = messages.reduce(
        (n, m) => n +
            (typeof m.content === "string"
                ? m.content.length
                : JSON.stringify(m.content).length)
        , 0)

    return Math.ceil(chars / 4)
}

export async function summarize(oldTurns: ModelMessage[][], priorSummary: string) {

    const transcript = oldTurns
        .flat()
        .map((m) => `${m.role}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`)
        .join("\n")
        .slice(0, 6000)
    const result = await generateText({
        model: openai(LLM_MODEL),
        messages: [
            {
                role: "system",
                content:
                    "You compress an agent's work log into a short running summary. Preserve concrete facts: item ids, categories, draft ids, amounts, and what was already sent. Be terse.",
            },
            {
                role: "user",
                content: `Prior summary:\n${priorSummary || "(none)"}\n\nFold in this newer work:\n${transcript}\n\nReturn the updated summary.`,
            },
        ],
    })

    return result.text
}

export function buildContext(
    systemPrompt: string,
    task: string,
    summary: string,
    turns: ModelMessage[][]
) {
    const context: ModelMessage[] = [
        {
            role: "system",
            content: systemPrompt
        },
        {
            role: "user",
            content: task
        }
    ]
    if (summary) {
        context[0].content += `Summary of earlier work so far:\n${summary}`
    }

    for (const turn of turns) {
        context.push(...turn)
    }

    return context
}