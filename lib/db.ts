import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/** Bindings available on the Pages Functions context (`c.env`). */
export type Env = { DATABASE_URL: string };

/** The Neon serverless (HTTP) query function — usable on the edge. */
export type Sql = NeonQueryFunction<false, false>;

/** Build a Neon client from the request env. Cheap; one per request is fine. */
export function getSql(env: Env): Sql {
  return neon(env.DATABASE_URL);
}
