import { EventType, type Emit, type EventInput } from "@shared/event";
import { randomUUID } from "node:crypto";

export async function runAgent({ input, emit }: { input: string, emit: Emit }) {
    const workflowId = randomUUID()
    emit({ type: EventType.WorkflowStarted, workflowId, input })

    emit({ type: EventType.Log, workflowId, level: "warn", message: "No agent yet." })

    emit({ type: EventType.WorkflowCompleted, workflowId, output: "(no agent implemented yet)" })
}