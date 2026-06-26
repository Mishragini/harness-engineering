import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import z from "zod";
import { LLM_MODEL } from "../config";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { emit } from "./bus";
import { EventType } from "@shared/event";
import { runInvestigation } from "./investigators";

const PlanSchema = z.object({
    steps: z.array(
        z.object({
            id: z.string().describe("short id, e.g. 'billing'"),
            agent: z.enum(["billing", "technical", "sales"]),
            objective: z.string().describe("what the investigator should find out")
        })
    )
})

async function makePlan(task: string) {
    const { output } = await generateText({
        model: openai(LLM_MODEL),
        output: Output.object({ schema: PlanSchema }),
        system:
            "Decompose a customer escalation into independent sub-tasks — one per area the message actually raises (billing / technical / sales). Only include relevant areas.",
        prompt: task
    })

    return output
}

async function synthesize(task: string, findings: { agent: string, findings: string }[]) {
    const { text } = await generateText({
        model: openai(LLM_MODEL),
        system:
            "You are a support lead. Using your investigators' findings, write ONE clear, friendly reply to the customer that addresses every point they raised. If an area's investigation is missing, acknowledge it briefly and say you'll follow up.",
        prompt: `Customer escalation:\n${task}\n\nInvestigator findings:\n${findings.map((f) => `[${f.agent}] ${f.findings}`).join("\n\n") || "(none)"
            }`
    })
    return text
}

async function supervisorWorkflow(task: string) {
    const workflowId = DBOS.workflowID ?? "unknown"

    await DBOS.runStep(
        () => emit({ type: EventType.WorkflowStarted, workflowId, input: task }),
        { name: 'started' }
    )

    const plan = await DBOS.runStep(
        () => makePlan(task),
        { name: "plan" }
    )

    const settled = await Promise.allSettled(
        plan.steps.map((s) =>
            DBOS.runStep(
                async () => {
                    await emit({
                        type: EventType.SubagentStarted,
                        workflowId,
                        stepId: s.id,
                        agent: s.agent,
                        objective: s.objective
                    })
                    const findings = await runInvestigation(s.agent, s.objective)
                    await emit({
                        type: EventType.SubagentCompleted,
                        workflowId,
                        stepId: s.id,
                        agent: s.agent,
                        findings
                    })
                    return { agent: s.agent, findings }
                },
                { name: `subagent-${s.id}` }
            )
        )
    )

    const findings: { agent: string, findings: string }[] = []

    settled.map(async (s, i) => {
        const step = plan.steps[i]
        if (s.status === "fulfilled") {
            findings.push(s.value)
        } else {
            await DBOS.runStep(
                () => emit({
                    type: EventType.SubagentFailed,
                    workflowId,
                    stepId: step.id,
                    agent: step.agent,
                    error: String(s.reason)
                }),
                { name: `subagent-failed-${step.id}` }
            )
        }
    })

    const reply = await DBOS.runStep(
        () => synthesize(task, findings),
        { name: "synth" }
    )

    await DBOS.runStep(
        () => emit({
            type: EventType.WorkflowCompleted,
            workflowId,
            output: reply
        })
    )
    return reply
}

export const runSupervisorWorkflow = DBOS.registerWorkflow(supervisorWorkflow, {
    name: "supervisorWorkflow"
})