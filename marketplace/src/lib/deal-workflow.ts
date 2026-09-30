// Build-spec deal workflow: the 9-state machine, its legal transitions, and
// the cancellation rules. Money helpers live in payment-workflow.ts.
import { calculateCommission, calculateCreatorPayout } from './payment-workflow';

export const WORKFLOW = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  CONFIRMED: 'CONFIRMED',
  COMMISSION_PAID: 'COMMISSION_PAID',
  ADVANCE_PAID: 'ADVANCE_PAID',
  CONTENT_UPLOADED: 'CONTENT_UPLOADED',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
  APPROVED_FOR_FINAL_PAYMENT: 'APPROVED_FOR_FINAL_PAYMENT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type WorkflowStatus = (typeof WORKFLOW)[keyof typeof WORKFLOW];

const TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMMISSION_PAID', 'CANCELLED'],
  // Past commission the brand has paid us; cancelling is no longer offered.
  COMMISSION_PAID: ['ADVANCE_PAID'],
  ADVANCE_PAID: ['CONTENT_UPLOADED'],
  CONTENT_UPLOADED: ['REVISION_REQUESTED', 'APPROVED_FOR_FINAL_PAYMENT'],
  REVISION_REQUESTED: ['CONTENT_UPLOADED'],
  APPROVED_FOR_FINAL_PAYMENT: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: string, to: WorkflowStatus): boolean {
  const allowed = TRANSITIONS[from as WorkflowStatus];
  return Array.isArray(allowed) && allowed.includes(to);
}

export function assertTransition(from: string, to: WorkflowStatus): void {
  if (!canTransition(from, to)) {
    throw new WorkflowError(`Cannot move deal from ${from} to ${to}`);
  }
}

export class WorkflowError extends Error {
  readonly isWorkflowError = true;
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowError';
  }
}

// Spec: cancellable up to and including CONFIRMED. Once commission is paid the
// money is ours and there is no refund; once the advance is paid the deal must
// run to completion.
const CANCELLABLE: WorkflowStatus[] = ['DRAFT', 'OPEN', 'CONFIRMED'];

export function canCancel(status: string): boolean {
  return CANCELLABLE.includes(status as WorkflowStatus);
}

export function cancellationBlockedReason(status: string): string | null {
  if (canCancel(status)) return null;
  if (status === WORKFLOW.COMMISSION_PAID) {
    return 'Commission has been paid. This deal cannot be cancelled and the commission is non-refundable.';
  }
  if (status === WORKFLOW.COMPLETED) return 'This deal is already completed.';
  if (status === WORKFLOW.CANCELLED) return 'This deal is already cancelled.';
  return 'The advance has been paid. This deal must run to completion.';
}

// Full money breakdown for a budget. Single source of truth for every
// payment endpoint, so amounts are never taken from the client.
export function dealFinancials(budget: number) {
  const commission = calculateCommission(budget);
  const creator = calculateCreatorPayout(budget, commission.total);
  return {
    budget,
    commissionBase: commission.base,
    commissionGst: commission.gst,
    commissionTotal: commission.total,
    creatorTotal: creator.total,
    advance: creator.advance,
    final: creator.final,
  };
}

// The amount owed for a given stage, derived server-side from the deal budget.
export function stageAmount(
  budget: number,
  type: 'COMMISSION' | 'ADVANCE' | 'FINAL'
): number {
  const f = dealFinancials(budget);
  if (type === 'COMMISSION') return f.commissionTotal;
  if (type === 'ADVANCE') return f.advance;
  return f.final;
}

// Which workflow status a confirmed payment of each type moves the deal into.
export const PAYMENT_ADVANCES_TO: Record<
  'COMMISSION' | 'ADVANCE' | 'FINAL',
  WorkflowStatus
> = {
  COMMISSION: WORKFLOW.COMMISSION_PAID,
  ADVANCE: WORKFLOW.ADVANCE_PAID,
  FINAL: WORKFLOW.COMPLETED,
};

// The status a deal must be in before each payment stage may be started.
export const PAYMENT_REQUIRES_STATUS: Record<
  'COMMISSION' | 'ADVANCE' | 'FINAL',
  WorkflowStatus
> = {
  COMMISSION: WORKFLOW.CONFIRMED,
  ADVANCE: WORKFLOW.COMMISSION_PAID,
  FINAL: WORKFLOW.APPROVED_FOR_FINAL_PAYMENT,
};

export function applicationsOpen(deal: {
  workflow_status: string;
  application_deadline: Date | string | null;
  applications_closed?: boolean;
}): boolean {
  if (deal.workflow_status !== WORKFLOW.OPEN) return false;
  if (deal.applications_closed) return false;
  if (!deal.application_deadline) return true;
  return new Date(deal.application_deadline).getTime() > Date.now();
}
