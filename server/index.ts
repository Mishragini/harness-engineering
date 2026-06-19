import express from "express"
import { WebSocketServer } from "ws"
import { createServer } from "http"
import { runAgent } from "../harness/runtime"
import { createEmitter, EventBus } from "./bus"
import { EventType } from "@shared/event"

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: "/ws" })

const bus = new EventBus()

bus.subscribe((event) => {
    const data = JSON.stringify(event)
    wss.clients.forEach((client) => client.readyState === client.OPEN && client.send(data))
})

wss.on("connection", (ws) => {
    ws.on("message", (data) => {
        let message
        try {
            message = JSON.parse(data.toString())
        } catch (error) {
            return
        }

        if (message.type === "submit_task") {
            const emit = createEmitter(bus)
            runAgent({ input: message.input, emit }).catch((error) => {
                emit({ type: EventType.Log, level: "error", message: String(error) })
            })
        }
    })
})

server.listen(8787, () => {
    console.log("Server is listening on port 8787")
})