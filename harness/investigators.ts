import { generateText, stepCountIs, tool, type ToolSet } from "ai";
import z from "zod";
import { CHARGES, searchKB } from "./tools";
import { openai } from "@ai-sdk/openai";
import { LLM_MODEL } from "../config";

const getCharges = tool({
    description: "Look up a customer's charges",
    inputSchema: z.object({
        customerId: z.string()
    }),
    execute: async ({ customerId }) => CHARGES[customerId] ?? []
})

const searchKnowledgeBase = tool({
    description: "Search the support knowledge base",
    inputSchema: z.object({
        query: z.string()
    }),
    execute: async ({ query }) => searchKB(query)
})

type Investigator = {
    systemPrompt: string,
    tools: ToolSet
}


const INVESTIGATORS: Record<string, Investigator> = {
    billing: {
        systemPrompt:
            "You are a billing investigator. Use getCharges to find duplicate or erroneous charges. Report the charge ids, the amount, and the refund you'd recommend — concisely.",
        tools: { getCharges },
    },
    technical: {
        systemPrompt:
            "You are a technical investigator. Use searchKnowledgeBase to find known bugs and workarounds. Report the issue, any ticket, and the workaround — concisely.",
        tools: { searchKnowledgeBase },
    },
    sales: {
        systemPrompt:
            "You are a sales investigator. Use searchKnowledgeBase for pricing guidance, then state the relevant numbers and next step — concisely.",
        tools: { searchKnowledgeBase },
    },
};


export async function runInvestigation(
    agent: string,
    objective: string
) {
    const investigator = INVESTIGATORS[agent]

    if (!investigator) {
        throw new Error("No investigator by that name")
    }

    const { text } = await generateText({
        model: openai(LLM_MODEL),
        system: investigator.systemPrompt,
        prompt: objective,
        tools: investigator.tools,
        stopWhen: stepCountIs(6)
    })

    return text
}