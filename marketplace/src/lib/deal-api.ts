// Browser client for the deal workflow endpoints.
//
// One rule runs through all of it: the client never sends an amount. The old
// checkout posted `commission * 100` from the page, which let anyone paying a
// deal choose what they paid. Every pay* call here sends only the deal id, and
// the server derives the amount from the deal's stored budget and returns the
// Razorpay order to open.
//
// Every response is one of these shapes, so callers can branch on `ok` instead
// of guessing from a status code.
export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = {
  ok: false;
  error: string;
  status: number;
  field?: string;
  reason?: string;
};
export type ApiResult<T> = ApiOk<T> | ApiErr;

// The project builds with `strict: false`, which disables strictNullChecks and
// with it the narrowing of a boolean-literal discriminant — `if (!r.ok)` does
// not give you the error branch. These guards do the narrowing explicitly and
// work either way.
export function isOk<T>(r: ApiResult<T>): r is ApiOk<T> {
  return r.ok === true;
}
export function isErr<T>(r: ApiResult<T>): r is ApiErr {
  return r.ok === false;
}

// `body` is our own JSON value, so RequestInit's BodyInit must be omitted
// first: an intersection would keep the stricter original type.
type CallInit = Omit<RequestInit, 'body'> & { body?: unknown };

async function call<T>(url: string, init?: CallInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init?.method || 'GET',
      // Identity comes from the session cookie; nothing is sent in a header.
      credentials: 'include',
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });

    const text = await res.text();
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        // The server sends generic messages by design; surface what it gave us
        // and fall back to something a user can act on.
        error: payload?.error || `Request failed (${res.status})`,
        field: payload?.field,
        reason: payload?.reason,
      };
    }
    return { ok: true, data: (payload ?? {}) as T };
  } catch (err) {
    // Network failure, offline, or the request was aborted.
    return {
      ok: false,
      status: 0,
      error: 'Could not reach the server. Check your connection and try again.',
    };
  }
}

// ---------------------------------------------------------------------------
// Types mirroring the workflow
// ---------------------------------------------------------------------------

export type WorkflowStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'CONFIRMED'
  | 'COMMISSION_PAID'
  | 'ADVANCE_PAID'
  | 'CONTENT_UPLOADED'
  | 'REVISION_REQUESTED'
  | 'APPROVED_FOR_FINAL_PAYMENT'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStage = 'commission' | 'advance' | 'remaining';

export interface FeedDeal {
  id: string;
  title: string;
  description: string;
  budget: string | number;
  application_deadline: string | null;
  content_upload_deadline: string | null;
  deal_deadline: string | null;
  published_at: string | null;
  brand_id: number;
  brand_username: string;
  brand_instagram_id: string | null;
  brand_followers: number | null;
  application_count: string | number;
  already_applied: boolean;
  applications_open: boolean;
}

export interface DealApplication {
  id: string;
  status: 'APPLIED' | 'CONFIRMED' | 'REJECTED';
  created_at: string;
  creator_id: number;
  username: string;
  display_name: string;
  instagram_user_id: string | null;
  instagram_profile_pic_url: string | null;
  followers_count: number | null;
  engagement_rate: number | null;
  completed_deals: number;
}

export interface RazorpayOrder {
  order_id: string;
  amount: number;
  amount_paise: number;
  currency: 'INR';
  key_id: string;
  type: 'COMMISSION' | 'ADVANCE' | 'FINAL';
}

// ---------------------------------------------------------------------------
// Onboarding: email, then payout details
// ---------------------------------------------------------------------------

export const getOnboardingStatus = () =>
  call<{
    email: string;
    email_verified: boolean;
    bank_details_completed: boolean;
    role: string;
    next_step: 'email' | 'verify_email' | 'bank_details' | 'ready';
  }>('/api/profile/set-email');

export const setEmail = (email: string) =>
  call<{ email: string; email_verified: boolean; next_step: string }>(
    '/api/profile/set-email',
    { method: 'POST', body: { email } }
  );

// Payout destination is UPI only: see /api/profile/payout-upi.
//
// The former setupPayout() and its endpoint accepted a bank account number and
// IFSC. Both are gone. A brand now pays the creator's UPI directly, so a UPI
// handle is the only destination we need — and unlike an account number, it is
// receive-only and designed to be shared. Leaving an endpoint that still took
// account numbers would have reintroduced exactly the data we stopped holding.
export const getPayoutUpi = () =>
  call<{
    masked: string | null;
    configured: boolean;
    consented: boolean;
    email_verified: boolean;
  }>('/api/profile/payout-upi');

/** Saves the UPI handle. Consent is required: it is shown to confirmed brands. */
export const setPayoutUpi = (upiId: string, shareConsent: boolean) =>
  call<{ configured: true; masked: string }>('/api/profile/payout-upi', {
    method: 'POST',
    body: { upi_id: upiId, share_consent: shareConsent },
  });

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

export const createDeal = (input: {
  title: string;
  description: string;
  budget: number;
  application_deadline: string;
  content_upload_deadline: string;
  deal_deadline: string;
  publish?: boolean;
}) =>
  call<{ deal_id: string; workflow_status: WorkflowStatus }>(
    '/api/deals/create-workflow-deal',
    { method: 'POST', body: { ...input, publish: input.publish ?? true } }
  );

/**
 * The open-deal feed. `since` asks for deals published after a cursor, so a
 * client that reconnects reconciles rather than trusting the live push alone.
 */
export const getFeed = (opts?: { since?: string | null; limit?: number }) => {
  const params = new URLSearchParams();
  if (opts?.since) params.set('since', opts.since);
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return call<{ deals: FeedDeal[]; cursor: string | null }>(
    `/api/deals/feed${qs ? `?${qs}` : ''}`
  );
};

/** Takes a DRAFT live. Without this a draft could never be seen or applied to. */
export const publishDeal = (dealId: string) =>
  call<{ workflow_status: 'OPEN'; published_at: string }>(
    `/api/deals/${dealId}/publish`,
    { method: 'POST' }
  );

export const applyToDeal = (dealId: string) =>
  call<{ application_id: string; status: 'APPLIED' }>('/api/applications', {
    method: 'POST',
    body: { deal_id: dealId },
  });

export const getMyApplications = () =>
  call<{ applications: any[] }>('/api/applications');

export const getDealApplications = (dealId: string) =>
  call<{
    deal_id: string;
    workflow_status: WorkflowStatus;
    applications: DealApplication[];
  }>(`/api/deals/${dealId}/applications`);

/** Confirming locks the deal to this creator and rejects everyone else. */
export const decideApplication = (
  applicationId: string,
  action: 'confirm' | 'reject'
) =>
  call<{
    status: 'CONFIRMED' | 'REJECTED';
    deal_id: string;
    creator_id?: number;
    others_rejected?: number;
    next_step?: string;
    commission_due?: number;
  }>(`/api/applications/${applicationId}`, { method: 'PATCH', body: { action } });

export const cancelDeal = (dealId: string, reason?: string) =>
  call<{ workflow_status: 'CANCELLED' }>(`/api/deals/${dealId}/cancel`, {
    method: 'POST',
    body: { reason: reason || '' },
  });

export const uploadContent = (dealId: string, contentLink: string) =>
  call<{ workflow_status: WorkflowStatus; revision_count: number }>(
    `/api/deals/${dealId}/upload-content`,
    { method: 'POST', body: { content_link: contentLink } }
  );

export const requestRevision = (dealId: string, feedback: string) =>
  call<{
    workflow_status: WorkflowStatus;
    revision_count: number;
    advisory?: string;
  }>(`/api/deals/${dealId}/suggest-changes`, {
    method: 'POST',
    body: { feedback },
  });

export const approveContent = (dealId: string) =>
  call<{ workflow_status: WorkflowStatus; next_step: string; final_due: number }>(
    `/api/deals/${dealId}/approve-final`,
    { method: 'POST' }
  );

export const getCommunications = (dealId: string) =>
  call<{ deal_id: string; communications: any[] }>(
    `/api/deals/${dealId}/communications`
  );

export const getVirtualResume = (username: string) =>
  call<any>(`/api/users/${encodeURIComponent(username)}/resume`);

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

/**
 * Opens a payment stage. Returns the Razorpay order to hand to checkout.
 * Note there is no amount parameter: the server computes it.
 */
export const startPayment = (dealId: string, stage: PaymentStage) =>
  call<RazorpayOrder>(`/api/deals/${dealId}/pay-${stage}`, { method: 'POST' });

let razorpayLoading: Promise<void> | null = null;

/** Loads the Razorpay checkout script once, reusing the in-flight promise. */
export function loadRazorpay(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if ((window as any).Razorpay) return Promise.resolve();
  if (razorpayLoading) return razorpayLoading;

  razorpayLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      razorpayLoading = null;
      reject(new Error('Could not load the payment gateway'));
    };
    document.body.appendChild(script);
  });
  return razorpayLoading;
}

export type PaymentOutcome =
  | { status: 'submitted'; paymentId: string; orderId: string }
  | { status: 'dismissed' }
  | { status: 'error'; error: string };

/**
 * Runs one payment stage end to end: ask the server for an order, open
 * checkout, and report what happened.
 *
 * "submitted" is deliberate wording. Razorpay's handler firing means the
 * payment was accepted for processing, not that our deal has advanced — the
 * webhook does that, server side. So the caller should refetch the deal rather
 * than assume the new status.
 */
export async function runPaymentStage(
  dealId: string,
  stage: PaymentStage,
  display: { name?: string; description?: string; themeColor?: string }
): Promise<PaymentOutcome> {
  const started = await startPayment(dealId, stage);
  if (isErr(started)) return { status: 'error', error: started.error };

  const order = started.data;
  if (!order.key_id) {
    return { status: 'error', error: 'Payments are not configured' };
  }

  try {
    await loadRazorpay();
  } catch (err) {
    return { status: 'error', error: (err as Error).message };
  }

  return new Promise<PaymentOutcome>((resolve) => {
    let settled = false;
    const done = (outcome: PaymentOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    try {
      const checkout = new (window as any).Razorpay({
        // The key comes from the server with the order, so the client never
        // hardcodes it and test/live cannot drift apart.
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount_paise,
        currency: order.currency,
        name: display.name || 'ValueSkins',
        description: display.description || `${order.type} payment`,
        theme: { color: display.themeColor || '#C8B89A' },
        handler: (response: any) =>
          done({
            status: 'submitted',
            paymentId: response?.razorpay_payment_id || '',
            orderId: response?.razorpay_order_id || order.order_id,
          }),
        modal: { ondismiss: () => done({ status: 'dismissed' }) },
      });
      checkout.on?.('payment.failed', (resp: any) =>
        done({
          status: 'error',
          error: resp?.error?.description || 'The payment failed',
        })
      );
      checkout.open();
    } catch (err) {
      done({ status: 'error', error: (err as Error).message });
    }
  });
}

// ---------------------------------------------------------------------------
// Status helpers for the UI
// ---------------------------------------------------------------------------

/** What the deal is waiting on, and who has to act. */
export function nextAction(status: WorkflowStatus): {
  actor: 'brand' | 'creator' | 'none';
  label: string;
} {
  switch (status) {
    case 'DRAFT':
      return { actor: 'brand', label: 'Publish this deal' };
    case 'OPEN':
      return { actor: 'creator', label: 'Waiting for applications' };
    case 'CONFIRMED':
      return { actor: 'brand', label: 'Pay the commission' };
    case 'COMMISSION_PAID':
      return { actor: 'brand', label: 'Pay the 30% advance' };
    case 'ADVANCE_PAID':
      return { actor: 'creator', label: 'Upload the content' };
    case 'CONTENT_UPLOADED':
      return { actor: 'brand', label: 'Review the content' };
    case 'REVISION_REQUESTED':
      return { actor: 'creator', label: 'Upload a revision' };
    case 'APPROVED_FOR_FINAL_PAYMENT':
      return { actor: 'brand', label: 'Pay the remaining 70%' };
    case 'COMPLETED':
      return { actor: 'none', label: 'Completed' };
    case 'CANCELLED':
      return { actor: 'none', label: 'Cancelled' };
    default:
      return { actor: 'none', label: String(status) };
  }
}

/** Spec: cancellable up to and including CONFIRMED, never after. */
export const canCancelDeal = (status: WorkflowStatus): boolean =>
  status === 'DRAFT' || status === 'OPEN' || status === 'CONFIRMED';

const ORDER: WorkflowStatus[] = [
  'OPEN',
  'CONFIRMED',
  'COMMISSION_PAID',
  'ADVANCE_PAID',
  'CONTENT_UPLOADED',
  'APPROVED_FOR_FINAL_PAYMENT',
  'COMPLETED',
];

/** 0..1 progress for a stepper. A revision counts as still at content stage. */
export function progressOf(status: WorkflowStatus): number {
  if (status === 'CANCELLED') return 0;
  const effective = status === 'REVISION_REQUESTED' ? 'ADVANCE_PAID' : status;
  const i = ORDER.indexOf(effective as WorkflowStatus);
  return i < 0 ? 0 : i / (ORDER.length - 1);
}

/** The money split, mirroring the server so the UI can show it before paying. */
export function financials(budget: number) {
  const commissionBase = 750;
  const commissionGst = Math.round(commissionBase * 0.18 * 100) / 100;
  const commissionTotal = Math.round((commissionBase + commissionGst) * 100) / 100;
  const creatorTotal = Math.round((budget - commissionTotal) * 100) / 100;
  return {
    commissionBase,
    commissionGst,
    commissionTotal,
    creatorTotal,
    advance: Math.round(creatorTotal * 0.3 * 100) / 100,
    final: Math.round(creatorTotal * 0.7 * 100) / 100,
  };
}
