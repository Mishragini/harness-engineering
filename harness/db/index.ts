import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
    throw new Error("DATABASE_URL is not set — copy .dev.vars.example to .dev.vars.")
}

const client = postgres(connectionString, { max: 5 })
export const db = drizzle(client)

export async function clearEventLog() {
    await client`TRUNCATE event_log`
}