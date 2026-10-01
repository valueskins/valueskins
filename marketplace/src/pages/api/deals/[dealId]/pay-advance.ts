// POST /api/deals/:dealId/pay-advance — Razorpay #2 (30% of the creator total).
import { makePaymentRoute } from '@/lib/deal-payment-route';

export default makePaymentRoute('ADVANCE');
