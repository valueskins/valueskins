import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth/require-user';
import { query } from '@/lib/db-pool';
import fs from 'fs';
import path from 'path';

/**
 * Runs a .sql file one statement at a time (the pg driver rejects multiple
 * statements in a single query call) and returns how many ran.
 *
 * Line comments are stripped BEFORE splitting. A statement preceded by a
 * comment block would otherwise leave a chunk starting with "--", which a
 * naive `startsWith('--')` filter drops — silently skipping real DDL.
 */
async function runSqlStatements(sql: string): Promise<number> {
  const statements = sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let ran = 0;
  for (const stmt of statements) {
    try {
      await query(stmt);
      ran++;
    } catch (err: any) {
      const msg = err?.message || '';
      // Re-running a migration is expected and safe.
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate column') ||
        msg.includes('duplicate key')
      ) {
        continue;
      }
      throw err;
    }
  }
  return ran;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const results: { name: string; success: boolean; error?: string }[] = [];
  let allPassed = true;

  // Build-spec deal workflow schema (006). Runs first: the workflow endpoints
  // and the later migrations both depend on its tables.
  try {
    const specPath = path.join(
      process.cwd(), 'src', 'lib', 'migrations', '006_build_spec_workflow.sql'
    );
    const ran = await runSqlStatements(fs.readFileSync(specPath, 'utf-8'));
    results.push({
      name: `006_build_spec_workflow.sql (${ran} statements)`,
      success: true,
    });
  } catch (err: any) {
    allPassed = false;
    results.push({
      name: '006_build_spec_workflow.sql',
      success: false,
      error: err.message,
    });
  }

  // Payout processing state (007). Depends on 006's payouts table.
  try {
    const payoutPath = path.join(
      process.cwd(), 'src', 'lib', 'migrations', '007_payout_processing.sql'
    );
    const ran = await runSqlStatements(fs.readFileSync(payoutPath, 'utf-8'));
    results.push({
      name: `007_payout_processing.sql (${ran} statements)`,
      success: true,
    });
  } catch (err: any) {
    allPassed = false;
    results.push({
      name: '007_payout_processing.sql',
      success: false,
      error: err.message,
    });
  }

  // Direct brand-to-creator payments (008). Depends on 006's deals columns.
  try {
    const dpPath = path.join(
      process.cwd(), 'src', 'lib', 'migrations', '008_direct_payments.sql'
    );
    const ran = await runSqlStatements(fs.readFileSync(dpPath, 'utf-8'));
    results.push({ name: `008_direct_payments.sql (${ran} statements)`, success: true });
  } catch (err: any) {
    allPassed = false;
    results.push({ name: '008_direct_payments.sql', success: false, error: err.message });
  }

  // Email attempt log (009). lib/email.ts writes to it on every send.
  try {
    const eqPath = path.join(process.cwd(), 'src', 'lib', 'migrations', '009_email_queue.sql');
    const ran = await runSqlStatements(fs.readFileSync(eqPath, 'utf-8'));
    results.push({ name: `009_email_queue.sql (${ran} statements)`, success: true });
  } catch (err: any) {
    allPassed = false;
    results.push({ name: '009_email_queue.sql', success: false, error: err.message });
  }

  // Run escrow-v2 migration SQL
  try {
    const sqlPath = path.join(process.cwd(), 'src', 'lib', 'migrations-escrow-v2.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Split on semicolons to run each statement individually
    // (pg driver can't run multiple statements in a single query call)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let ran = 0;

    for (const stmt of statements) {
      try {
        await query(stmt);
        ran++;
      } catch (err: any) {
        // "already exists" errors are safe to skip
        const msg = err.message || '';
        if (msg.includes('already exists') || msg.includes('duplicate column')) {
          continue;
        }
        throw err;
      }
    }

    results.push({ name: 'migrations-escrow-v2.sql', success: true });
  } catch (err: any) {
    allPassed = false;
    results.push({ name: 'migrations-escrow-v2.sql', success: false, error: err.message });
  }

  // Run index migrations (100k-user scale)
  try {
    const { runIndexMigrations } = await import('@/lib/migrations-indexes');
    await runIndexMigrations();
    results.push({ name: 'runIndexMigrations', success: true });
  } catch (err: any) {
    allPassed = false;
    results.push({ name: 'runIndexMigrations', success: false, error: err.message });
  }

  // Also run the TypeScript-based migrations for older tables
  try {
    const { runMigrations2, addRemindersTables, addEscrowMigrations, addCreatorProfileColumns, addEventFeaturesMigrations } = await import('@/lib/migrations-2');
    await runMigrations2();
    results.push({ name: 'runMigrations2', success: true });
    await addRemindersTables();
    results.push({ name: 'addRemindersTables', success: true });
    await addEscrowMigrations();
    results.push({ name: 'addEscrowMigrations', success: true });
    await addCreatorProfileColumns();
    results.push({ name: 'addCreatorProfileColumns', success: true });
    await addEventFeaturesMigrations();
    results.push({ name: 'addEventFeaturesMigrations', success: true });
  } catch (err: any) {
    allPassed = false;
    results.push({ name: 'ts-migrations', success: false, error: err.message });
  }

  return res.status(allPassed ? 200 : 500).json({
    success: allPassed,
    results,
    timestamp: new Date().toISOString(),
  });
}
