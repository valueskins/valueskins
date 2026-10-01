// Ownership and role guards for the deal workflow endpoints.
// Every deal endpoint resolves the caller with requireUser and then proves the
// caller is the deal's brand or its confirmed creator. Without this a user can
// drive someone else's deal by guessing an id (IDOR).
import { queryOne } from '@/lib/db-pool';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export interface DealRow {
  id: string;
  brand_id: number | null;
  creator_id: number | null;
  title: string;
  description: string;
  amount: string | number;
  workflow_status: string;
  application_deadline: string | null;
  content_upload_deadline: string | null;
  deal_deadline: string | null;
  content_link: string;
  content_uploaded_at: string | null;
  feedback: string;
  revision_count: number;
  applications_closed: boolean;
  published_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export async function loadDeal(dealId: unknown): Promise<DealRow | null> {
  if (!isUuid(dealId)) return null;
  const row = await queryOne(
    `SELECT id, brand_id, creator_id, title, description, amount, workflow_status,
            application_deadline, content_upload_deadline, deal_deadline,
            content_link, content_uploaded_at, feedback, revision_count,
            applications_closed, published_at, cancelled_at, created_at
       FROM deals WHERE id = $1`,
    [dealId]
  );
  return (row as DealRow) || null;
}

export function isBrandOwner(deal: DealRow, userId: string | number): boolean {
  return deal.brand_id !== null && String(deal.brand_id) === String(userId);
}

export function isConfirmedCreator(deal: DealRow, userId: string | number): boolean {
  return deal.creator_id !== null && String(deal.creator_id) === String(userId);
}

export function isParticipant(deal: DealRow, userId: string | number): boolean {
  return isBrandOwner(deal, userId) || isConfirmedCreator(deal, userId);
}

export async function getUserRole(userId: string | number): Promise<string | null> {
  const row = await queryOne('SELECT role FROM users WHERE id = $1', [userId]);
  return (row as any)?.role ?? null;
}

// Spec: email must be on file and verified, and bank details entered, before a
// user can transact. Checked at the point of use rather than trusted from the
// client.
export async function getTransactReadiness(userId: string | number): Promise<{
  ready: boolean;
  reason?: string;
}> {
  const row = await queryOne(
    'SELECT email, email_verified, bank_details_completed FROM users WHERE id = $1',
    [userId]
  );
  const u = row as any;
  if (!u) return { ready: false, reason: 'user_not_found' };
  if (!u.email) return { ready: false, reason: 'email_required' };
  if (!u.email_verified) return { ready: false, reason: 'email_not_verified' };
  if (!u.bank_details_completed) return { ready: false, reason: 'bank_details_required' };
  return { ready: true };
}

// Money never comes from the client. The deal's stored budget is the only input.
export function dealBudget(deal: DealRow): number {
  return Number(deal.amount) || 0;
}
