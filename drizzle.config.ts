import { defineConfig } from "drizzle-kit";
import { DATABASE_URL } from "./config"
export default defineConfig({
    dialect: "postgresql",
    schema: "./harness/db/schema.ts",
    out: "./drizzle",
    dbCredentials: {
        url: DATABASE_URL
    }
});
