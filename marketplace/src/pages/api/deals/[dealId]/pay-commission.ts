// POST /api/deals/:dealId/pay-commission — Razorpay #1 (750 + 18% GST = 885).
import { makePaymentRoute } from '@/lib/deal-payment-route';

export default makePaymentRoute('COMMISSION');
