import { tool } from "ai"
import z from "zod"
import { runInSandbox } from "./sandbox";

type Charge = { id: string, amount: number, date: string, description: string }
const CHARGES: Record<string, Charge[]> = {
    "cus_88121": [
        { id: "ch_001", amount: 4900, date: "2026-05-01", description: "Pro plan — monthly" },
        { id: "ch_002", amount: 4900, date: "2026-05-01", description: "Pro plan — monthly" },
        { id: "ch_003", amount: 1500, date: "2026-04-18", description: "Extra seats" },
    ]
}

const KNOWLEDGE_BASE: Record<string, string> = {
    billing:
        "Double charges are usually a duplicate authorization that drops off in 3–5 days. If it already settled, refund immediately.",
    refund: "Refunds post in 5–10 business days. Pro accounts can be expedited.",
    export:
        "The Safari export failure is a known bug (TICKET-4412). Workaround: use Chrome or the CSV export.",
    pricing:
        "Team plans are $20/seat/mo with a volume discount at 25+ seats. For 50+ seats, send the pricing PDF.",
};

const searchKB = async (query: string) => {
    const hits = Object.entries(KNOWLEDGE_BASE)
        .filter(([key]) => query.includes(key))
        .map(([, article]) => article)
    return { articles: hits.length ? hits : ["No exact match found- use your judgement"] }
}

const sandboxApi = {
    getCharges: async (customerId: string) => CHARGES[customerId] ?? [],
    searchKnowledgeBase: async (query: string) => searchKB(query)
}


export const tools = {
    searchKnowledgeBase: tool({
        description: "Search the support knowledge base for relevant articles.",
        inputSchema: z.object({
            query: z.string().describe("what to look up")
        })
    }),

    classifyItem: tool({
        description: "Classify a work item into a category.",
        inputSchema: z.object({
            itemId: z.string(),
            category: z.enum(["billing", "technical", "sales", "other"]),
        }),
    }),

    draftReply: tool({
        description: "Write a draft reply for a work item. Does not send anything.",
        inputSchema: z.object({
            itemId: z.string(),
            message: z.string(),
        }),
    }),

    sendReply: tool({
        description: "Send the drafted reply to the customer. This really emails them.",
        inputSchema: z.object({
            itemId: z.string(),
            draftId: z.string(),
        }),
    }),
    runCode: tool({
        description: [
            "Run a JavaScript program (an async function body) to fetch and analyze data.",
            "Available inside the program:",
            "  • await tools.getCharges(customerId) → [{ id, amount (cents), date, description }]",
            "  • await tools.searchKnowledgeBase(query) → string[]",
            "  • console.log(...) for debugging",
            "Use `return` to return your result (any JSON value).",
        ].join("\n"),
        inputSchema: z.object({ code: z.string() }),
    })
}

export async function runTool(name: string, args: Record<string, unknown>) {
    switch (name) {
        case "searchKnowledgeBase":
            const query = String(args.query ?? "").toLowerCase()
            return searchKB(query)
        case "classifyItem":
            return { ok: true, itemId: args.itemId, category: args.category }
        case "draftReply":
            return { ok: true, draftId: `draft-${args.itemId}` }
        case "sendReply":
            return { sent: true, itemId: args.itemId, draftId: args.draftId }
        case "runCode":
            const code = String(args.code) ?? ''
            return runInSandbox(code, sandboxApi)
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}