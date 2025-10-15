import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema";

/**
 * Database connection instance using Bun's native PostgreSQL driver.
 *
 * Automatically connects using the DATABASE_URL environment variable
 * which is configured in mise.toml.
 */
export const db = drizzle(process.env.DATABASE_URL!, { schema });
