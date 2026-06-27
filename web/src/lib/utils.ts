import type { ToolPart } from "@/components/ui/tool"
import { EventType, type AgentEvent } from "@shared/event"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export type SubagentState = "pending" | "started" | "completed" | "failed";
type Subagent = {
  stepId: string;
  agent: string;
  objective: string;
  state: SubagentState;
  findings: string;
};

export type Turn =
  | { id: string, role: "user", text: string }
  | { id: string, role: "assistant", text: string }
  | { id: string, role: "tool", part: ToolPart }
  | { id: string; role: "handoff"; from: string; to: string; reason: string }
  | { id: string; role: "supervision"; subagents: Subagent[] }
  | {
    id: string;
    role: "approval";
    workflowId: string;
    action: string;
    args: unknown;
    state: "pending" | "approved" | "rejected";
  }
  | { id: string; role: "log"; level: string; text: string };

export function toTranscript(events: AgentEvent[]): { turns: Turn[]; running: boolean } {
  const turns: Turn[] = [];
  let assistant: Extract<Turn, { role: "assistant" }> | null = null;
  let supervision: Extract<Turn, { role: "supervision" }> | null = null;
  const toolsById = new Map<string, Extract<Turn, { role: "tool" }>>();
  const approvalsById = new Map<string, Extract<Turn, { role: "approval" }>>();
  let open = 0;

  const sub = (stepId: string) => supervision?.subagents.find((s) => s.stepId === stepId);

  for (const ev of events) {
    switch (ev.type) {
      case EventType.WorkflowStarted:
        open++;
        assistant = null;
        turns.push({ id: ev.id, role: "user", text: ev.input });
        break;
      case EventType.WorkflowCompleted:
      case EventType.WorkflowFailed:
        open = Math.max(0, open - 1);
        assistant = null;
        break;
      case EventType.ModelDelta:
        if (!assistant) {
          assistant = { id: ev.id, role: "assistant", text: "" };
          turns.push(assistant);
        }
        assistant.text += ev.text;
        break;
      case EventType.ModelCompleted:
        if (assistant) assistant.text = ev.text;
        else turns.push({ id: ev.id, role: "assistant", text: ev.text });
        assistant = null;
        break;
      case EventType.ToolRequested: {
        const turn: Extract<Turn, { role: "tool" }> = {
          id: ev.id,
          role: "tool",
          part: {
            type: ev.name,
            state: "input-available",
            input: ev.args as Record<string, unknown>,
            toolCallId: ev.toolCallId,
          },
        };
        toolsById.set(ev.toolCallId, turn);
        turns.push(turn);
        assistant = null;
        break;
      }
      case EventType.ToolCompleted: {
        const turn = toolsById.get(ev.toolCallId);
        if (turn) {
          turn.part = {
            ...turn.part,
            state: "output-available",
            output: ev.result as Record<string, unknown>,
          };
        }
        break;
      }
      case EventType.ToolFailed: {
        const turn = toolsById.get(ev.toolCallId);
        if (turn) turn.part = { ...turn.part, state: "output-error", errorText: ev.error };
        break;
      }
      case EventType.AgentHandoff:
        assistant = null;
        turns.push({ id: ev.id, role: "handoff", from: ev.from, to: ev.to, reason: ev.reason });
        break;
      case EventType.PlanCreated:
        assistant = null;
        supervision = {
          id: ev.id,
          role: "supervision",
          subagents: ev.steps.map((s) => ({
            stepId: s.id,
            agent: s.agent,
            objective: s.objective,
            state: "pending",
            findings: "",
          })),
        };
        turns.push(supervision);
        break;
      case EventType.SubagentStarted: {
        const s = sub(ev.stepId);
        if (s) s.state = "started";
        break;
      }
      case EventType.SubagentCompleted: {
        const s = sub(ev.stepId);
        if (s) {
          s.state = "completed";
          s.findings = ev.findings;
        }
        break;
      }
      case EventType.SubagentFailed: {
        const s = sub(ev.stepId);
        if (s) {
          s.state = "failed";
          s.findings = ev.error;
        }
        break;
      }
      case EventType.ApprovalRequested: {
        assistant = null;
        const turn: Extract<Turn, { role: "approval" }> = {
          id: ev.id,
          role: "approval",
          workflowId: ev.workflowId,
          action: ev.action,
          args: ev.args,
          state: "pending",
        };
        approvalsById.set(ev.toolCallId, turn);
        turns.push(turn);
        break;
      }
      case EventType.ApprovalResolved: {
        const turn = approvalsById.get(ev.toolCallId);
        if (turn) turn.state = ev.approved ? "approved" : "rejected";
        break;
      }
      case EventType.Log:
        turns.push({ id: ev.id, role: "log", level: ev.level, text: ev.message });
        break;
    }
  }

  return { turns, running: open > 0 };
}

