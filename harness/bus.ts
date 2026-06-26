import { randomUUID } from "node:crypto"
import type { AgentEvent, EventInput } from "@shared/event"
import { db } from "./db"
import { eventLog } from "./db/schema"

type listener = (event: AgentEvent) => void
const listeners = new Set<listener>()


export async function emit(input: EventInput) {
    const event = { ...input, id: randomUUID(), ts: Date.now() }
    await db.insert(eventLog).values({ data: event })
    for (const listener of listeners) {
        listener(event)
    }
}


export function subscribe(listener: listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)

}


export async function history() {
    const rows = await db.select().from(eventLog).orderBy(eventLog.seq)
    return rows.map((r) => r.data)
}
