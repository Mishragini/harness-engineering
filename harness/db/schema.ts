import type { AgentEvent } from "@shared/event";
import { bigserial, jsonb, pgTable } from "drizzle-orm/pg-core";

export const eventLog = pgTable("event_log", {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    data: jsonb("data").$type<AgentEvent>().notNull()
})