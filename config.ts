import { config } from "dotenv"
config({ path: '.dev.vars' })

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ""
export const DATABASE_URL = process.env.DATABASE_URL || ""