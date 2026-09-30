// Per-user action quotas for the deal workflow.
//
// These count the real rows rather than keeping a separate counter. The
// in-memory limiter in lib/rate-limit is per-process, so on serverless each
// instance holds its own tally and the effective limit multiplies by the
// instance count. Counting deals and applications directly is exact regardless
// of which instance serves the request, and these are low-frequency actions so
// the extra query is cheap.
import { queryOne } from '@/lib/db-pool';

export const QUOTAS = {
  DEALS_PER_DAY: 10,
  APPLICATIONS_PER_DAY: 20,
  UPLOADS_PER_DEAL: 5,
} as const;

export interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  retryAfterSeconds?: number;
}

export async function checkDealCreationQuota(brandId: string | number): Promise<QuotaResult> {
  const row = await queryOne(
    `SELECT COUNT(*)::int AS used,
            MIN(created_at) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS oldest
       FROM deals
      WHERE brand_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [brandId]
  );
  return toResult(row, QUOTAS.DEALS_PER_DAY);
}

export async function checkApplicationQuota(creatorId: string | number): Promise<QuotaResult> {
  const row = await queryOne(
    `SELECT COUNT(*)::int AS used,
            MIN(created_at) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS oldest
       FROM applications
      WHERE creator_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [creatorId]
  );
  return toResult(row, QUOTAS.APPLICATIONS_PER_DAY);
}

// Spec: 5 uploads per deal across all phases. revision_count counts re-uploads,
// so the first submission plus 5 revisions is the ceiling.
export function checkUploadQuota(revisionCount: number): QuotaResult {
  const used = Number(revisionCount) || 0;
  return {
    allowed: used < QUOTAS.UPLOADS_PER_DEAL,
    used,
    limit: QUOTAS.UPLOADS_PER_DEAL,
  };
}

function toResult(row: any, limit: number): QuotaResult {
  const used = Number(row?.used ?? 0);
  const allowed = used < limit;
  // Tell the caller when the window frees up rather than making them poll.
  let retryAfterSeconds: number | undefined;
  if (!allowed && row?.oldest) {
    const freesAt = new Date(row.oldest).getTime() + 24 * 60 * 60 * 1000;
    retryAfterSeconds = Math.max(1, Math.ceil((freesAt - Date.now()) / 1000));
  }
  return { allowed, used, limit, retryAfterSeconds };
}
