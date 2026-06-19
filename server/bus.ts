import { randomUUID } from "node:crypto"
import type { AgentEvent, Emit, EventInput } from "@shared/event"

type listener = (event: AgentEvent) => void

export class EventBus {
    private listeners = new Set<listener>()
    private bufferHistory: AgentEvent[] = []
    private readonly max = 1000

    emit(input: EventInput) {
        const event = { ...input, id: randomUUID(), ts: Date.now() }
        this.bufferHistory.push(event)
        if (this.bufferHistory.length > this.max) {
            this.bufferHistory.shift()
        }
        for (const listener of this.listeners) {
            listener(event)
        }
        return event
    }


    subscribe(listener: listener) {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)

    }


    history() {
        return this.bufferHistory
    }
}

export function createEmitter(bus: EventBus): Emit {
    return (input) => {
        bus.emit(input)
    }
}