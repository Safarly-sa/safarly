import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // A path relative to this file, not `path.join(__dirname, ...)` — that
  // produces backslashes on Windows, which drizzle-kit's schema glob
  // resolution silently fails to match ("No schema files found for path
  // config"), even though the file exists at the exact path it printed.
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
