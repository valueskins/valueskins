import Razorpay from 'razorpay';

import crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

export { razorpay };

export interface CreateOrderParams {
  amount: number; // in paise
  currency?: string;
  receipt?: string;
  customer_notify?: 0 | 1;
  notes?: Record<string, any>;
}

export interface CreatePayoutParams {
  account_number: string;
  fund_account_id?: string;
  amount: number; // in paise
  currency?: string;
  mode: 'NEFT' | 'RTGS' | 'IMPS' | 'UPI';
  purpose: 'payout' | 'refund' | 'settlement';
  receipt?: string;
  reference_id?: string;
  notes?: Record<string, any>;
}

export async function createOrder(params: CreateOrderParams) {
  try {
    const order = await razorpay.orders.create(params as any);
    return { success: true, data: order };
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    return { success: false, error };
  }
}

export async function fetchOrder(orderId: string) {
  try {
    const order = await razorpay.orders.fetch(orderId);
    return { success: true, data: order };
  } catch (error) {
    console.error('Razorpay order fetch failed:', error);
    return { success: false, error };
  }
}

export async function createTransfer(orderId: string, transfers: any[]) {
  try {
    const result = await ((razorpay as any).orders.createTransfer as any)(orderId, transfers);
    return { success: true, data: result };
  } catch (error) {
    console.error('Razorpay transfer creation failed:', error);
    return { success: false, error };
  }
}

// Delegates to lib/razorpay-payouts. The SDK instance has no `payouts`
// resource. Note payouts require RazorpayX to be activated on the account;
// without it Razorpay answers "Access to requested resource not available".
export async function createPayout(params: CreatePayoutParams) {
  try {
    const { sendPayout } = await import('./razorpay-payouts');
    const result = await sendPayout({
      fundAccountId: params.fund_account_id || '',
      amount: params.amount / 100, // callers pass paise; sendPayout takes rupees
      referenceId: params.reference_id || params.receipt || '',
      narration: params.purpose,
    });
    return { success: true as const, data: { id: result.payoutId, status: result.status } };
  } catch (error) {
    console.error('Razorpay payout creation failed:', (error as Error).message);
    return { success: false as const, error };
  }
}

export async function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<boolean> {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return expectedSignature === signature;
}

// Delegates to lib/razorpay-payouts. The SDK instance has no `contacts`
// resource, so the previous implementation (`razorpay.contacts.create`) threw
// TypeError on every call. Kept as a wrapper because existing callers expect
// the { success, data } shape.
export async function createContact(params: {
  name: string;
  email?: string;
  type?: string;
  reference_id?: string;
}) {
  try {
    const userId = (params.reference_id || '').replace(/^user_/, '') || params.name;
    const { ensureContact } = await import('./razorpay-payouts');
    const { contactId } = await ensureContact({
      userId,
      name: params.name,
      email: params.email,
    });
    return { success: true as const, data: { id: contactId } };
  } catch (error) {
    // Never log `params`: for the payout flow it sits beside account details.
    console.error('Razorpay contact creation failed:', (error as Error).message);
    return { success: false as const, error };
  }
}

// Delegates to lib/razorpay-payouts. The SDK exposes `fundAccount` (singular),
// not `fundAccounts`, so the previous implementation threw TypeError. The raw
// details are forwarded to Razorpay and only the token is returned — the
// account number is never logged or persisted here.
export async function createFundAccount(params: {
  contactId: string;
  accountType: string;
  bankAccount: {
    name: string;
    accountNumber: string;
    ifsc: string;
  };
}) {
  try {
    const { tokeniseAccount } = await import('./razorpay-payouts');
    const token = await tokeniseAccount(params.contactId, {
      kind: 'bank',
      accountNumber: params.bankAccount.accountNumber,
      ifsc: params.bankAccount.ifsc,
      holderName: params.bankAccount.name,
    });
    return {
      success: true as const,
      data: { id: token.fundAccountId, display_hint: token.displayHint },
    };
  } catch (error) {
    console.error('Razorpay fund account creation failed:', (error as Error).message);
    return { success: false as const, error };
  }
}

export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return expected === signature;
}

const KNOWN_RAZORPAY_IPS: string[] = [];

export function isKnownRazorpayIp(ip: string): boolean {
  return KNOWN_RAZORPAY_IPS.includes(ip);
}
