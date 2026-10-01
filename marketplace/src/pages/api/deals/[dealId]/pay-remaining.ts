// POST /api/deals/:dealId/pay-remaining — Razorpay #3 (70% of the creator total).
import { makePaymentRoute } from '@/lib/deal-payment-route';

export default makePaymentRoute('FINAL');
