export enum EventType {
    WorkflowStarted = "workflow.started",
    WorkflowCompleted = "workflow.completed",
    WorkflowFailed = "workflow.failed",

    ModelDelta = "model.delta",
    ModelCompleted = "model.completed",

    ToolRequested = "tool.requested",
    ToolCompleted = "tool.completed",
    ToolFailed = "tool.failed",

    MemoryCompacted = "memory.compacted",

    AgentHandoff = "agent.handoff",

    PlanCreated = "plan.created",

    SubagentStarted = "subagent.started",
    SubagentCompleted = "subagent.completed",
    SubagentFailed = "subagent.failed",

    ApprovalRequested = "approval.requested",
    ApprovalResolved = "approval.resolved",

    Log = "log"
}

export type EventInput =
    | { type: EventType.WorkflowStarted; workflowId: string; input: string }
    | { type: EventType.WorkflowCompleted; workflowId: string; output: string }
    | { type: EventType.WorkflowFailed; workflowId: string; error: string }
    | { type: EventType.ModelDelta; workflowId: string; text: string }
    | { type: EventType.ModelCompleted; workflowId: string; text: string }
    | { type: EventType.ToolRequested; workflowId: string; toolCallId: string; name: string; args: unknown }
    | { type: EventType.ToolCompleted; workflowId: string; toolCallId: string; result: unknown }
    | { type: EventType.ToolFailed; workflowId: string; toolCallId: string; error: string }
    | { type: EventType.MemoryCompacted; workflowId: string; summarizedTurns: number; contextTokens: number; summary: string }
    | { type: EventType.AgentHandoff; workflowId: string; from: string; to: string; reason: string }
    | { type: EventType.PlanCreated; workflowId: string; steps: { id: string; agent: string; objective: string }[] }
    | { type: EventType.SubagentStarted; workflowId: string; stepId: string; agent: string; objective: string }
    | { type: EventType.SubagentCompleted; workflowId: string; stepId: string; agent: string; findings: string }
    | { type: EventType.SubagentFailed; workflowId: string; stepId: string; agent: string; error: string }
    | { type: EventType.ApprovalRequested; workflowId: string; toolCallId: string; action: string; args: unknown }
    | { type: EventType.ApprovalResolved; workflowId: string; toolCallId: string; approved: boolean }
    | { type: EventType.Log; workflowId?: string; level: "info" | "warn" | "error"; message: string };


export type AgentEvent = EventInput & { id: string, ts: number }


export type Emit = (event: EventInput) => void


export type ClientMessage = {
    type: "submit_task",
    input: string,
    mode: "default" | "supervised"
}