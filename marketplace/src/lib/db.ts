import { Pool, PoolClient } from 'pg';

const dbUrl = process.env.DATABASE_URL || '';
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('host.docker.internal');
const sslConfig = isLocal ? false : { rejectUnauthorized: false };

// Pool sizing is a serverless problem, not a throughput one.
//
// This was max:100, min:2. On Vercel every function instance builds its OWN
// pool, so those numbers are per-instance, not per-app — two warm instances
// already exceeded the database's max_connections of 103, and each cold start
// eagerly opened 2 more connections and held them. Under any real concurrency
// Postgres starts refusing connections, which surfaces as the same
// "Connection terminated unexpectedly" that a suspended instance produces.
//
// max:5 gives a single instance enough concurrency for the handful of queries
// an API route fires, while leaving room for ~20 instances inside the limit.
// min:0 means an idle instance holds nothing, and the shorter idle timeout
// returns connections quickly so other instances can have them.
// The pool is pinned to globalThis, not to this module.
//
// Next bundles each API route separately, so `import { query } from '@/lib/db'`
// gave every route its OWN module instance and therefore its own Pool. Measured
// against this database: a warm query is ~75ms but connect+TLS is ~2200ms, and
// routes were paying the connect cost repeatedly instead of reusing a
// connection — /api/profile/stats took ~1350ms for a single indexed SELECT.
//
// One pool per process also means the max:5 cap is actually a per-process cap
// rather than per-route, which matters against max_connections = 103.
const globalForPg = globalThis as unknown as { __vsPool?: Pool };

const pool = globalForPg.__vsPool ?? new Pool({
  connectionString: dbUrl,
  ssl: sslConfig,
  max: isLocal ? 20 : 5,
  min: 0,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 15000,
  query_timeout: 15000,
});

if (!globalForPg.__vsPool) {
  globalForPg.__vsPool = pool;
  pool.on('error', (err) => {
    console.error('Unexpected pool error:', err);
  });
}

export async function query(text: string, params?: any[]) {
  const result = await pool.query(text, params);
  return result;
}

export async function queryOne(text: string, params?: any[]) {
  const result = await pool.query(text, params);
  return result.rows[0] || null;
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// db-pool re-exports this, so it must actually be exported: the re-export
// previously resolved to undefined at runtime and tsc flagged it (TS2459).
export { pool };

export async function getPool(): Promise<Pool> {
  return pool;
}
