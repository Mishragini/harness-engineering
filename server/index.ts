import express from "express"
import { WebSocketServer } from "ws"
import { createServer } from "http"
import type { ClientMessage } from "@shared/event"
import { DBOS } from "@dbos-inc/dbos-sdk"
import { history, subscribe } from "../harness/bus"
import { runAgentWorkflow } from "../harness/runtime"
import { runSupervisorWorkflow } from "../harness/supervisor"
import { clearEventLog } from "../harness/db"
import cors from "cors"

async function main() {
    DBOS.setConfig({
        "name": "harness",
        "systemDatabaseUrl": process.env.DATABASE_URL,
    });
    await DBOS.launch();


    const app = express()
    app.use(cors({ origin: "*" }))
    app.use(express.json())
    app.get("/health", (_req, res) => {
        res.json({ ok: true })
    })

    app.post("/api/clear", async (_req, res) => {
        await clearEventLog()
        res.json({ ok: true })
    })

    app.post("/api/approve/:workflowId", async (req, res) => {
        const approved = Boolean(req.body?.approved);
        await DBOS.send(req.params.workflowId, { approved }, "approval");
        res.json({ ok: true });
    });


    const server = createServer(app)
    const wss = new WebSocketServer({ server, path: "/ws" })

    subscribe((event) => {
        const data = JSON.stringify(event)
        for (const client of wss.clients) {
            if (client.readyState === client.OPEN) client.send(data)
        }
    })

    wss.on("connection", async (ws) => {
        console.log("connected..")
        ws.on("message", async (data) => {
            let message: ClientMessage
            try {
                message = JSON.parse(data.toString())
            } catch (error) {
                return
            }

            if (message.type === "submit_task") {
                console.log("message...", message)
                const workflow = message.mode === "supervised" ? runSupervisorWorkflow : runAgentWorkflow
                console.log("workflow..", workflow)
                await DBOS.startWorkflow(workflow)(message.input)

            }
        })
        for (const event of await history()) ws.send(JSON.stringify(event))

    })


    server.listen(8787, () => {
        console.log("Server is listening on port 8787")
    })
}

main().catch((e) => {
    console.error("error:", e)
    process.exit(1)
})






