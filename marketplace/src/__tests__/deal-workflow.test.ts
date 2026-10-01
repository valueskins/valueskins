import {
  dealFinancials,
  stageAmount,
  canTransition,
  canCancel,
  cancellationBlockedReason,
  applicationsOpen,
} from '@/lib/deal-workflow';

describe('deal financials', () => {
  // The worked example from the build spec.
  it('splits a 10,000 budget exactly as specified', () => {
    const f = dealFinancials(10000);
    expect(f.commissionBase).toBe(750);
    expect(f.commissionGst).toBe(135);
    expect(f.commissionTotal).toBe(885);
    expect(f.creatorTotal).toBe(9115);
    expect(f.advance).toBe(2734.5);
    expect(f.final).toBe(6380.5);
  });

  it('never loses or invents money when rounding', () => {
    for (const budget of [1000, 9999, 12345, 88501, 1000000]) {
      const f = dealFinancials(budget);
      const sum = Math.round((f.commissionTotal + f.advance + f.final) * 100) / 100;
      expect(sum).toBe(budget);
    }
  });

  it('derives each stage amount from the budget', () => {
    expect(stageAmount(10000, 'COMMISSION')).toBe(885);
    expect(stageAmount(10000, 'ADVANCE')).toBe(2734.5);
    expect(stageAmount(10000, 'FINAL')).toBe(6380.5);
  });
});

describe('workflow transitions', () => {
  it('allows the happy path end to end', () => {
    const path: [string, any][] = [
      ['DRAFT', 'OPEN'],
      ['OPEN', 'CONFIRMED'],
      ['CONFIRMED', 'COMMISSION_PAID'],
      ['COMMISSION_PAID', 'ADVANCE_PAID'],
      ['ADVANCE_PAID', 'CONTENT_UPLOADED'],
      ['CONTENT_UPLOADED', 'APPROVED_FOR_FINAL_PAYMENT'],
      ['APPROVED_FOR_FINAL_PAYMENT', 'COMPLETED'],
    ];
    for (const [from, to] of path) {
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it('allows the revision loop to repeat', () => {
    expect(canTransition('CONTENT_UPLOADED', 'REVISION_REQUESTED')).toBe(true);
    expect(canTransition('REVISION_REQUESTED', 'CONTENT_UPLOADED')).toBe(true);
  });

  // Skipping a stage would mean taking the next payment without the previous
  // one having landed.
  it('refuses to skip a stage', () => {
    expect(canTransition('CONFIRMED', 'ADVANCE_PAID')).toBe(false);
    expect(canTransition('ADVANCE_PAID', 'COMPLETED')).toBe(false);
    expect(canTransition('CONTENT_UPLOADED', 'COMPLETED')).toBe(false);
    expect(canTransition('OPEN', 'COMPLETED')).toBe(false);
    expect(canTransition('DRAFT', 'CONFIRMED')).toBe(false);
  });

  it('treats COMPLETED as terminal', () => {
    expect(canTransition('COMPLETED', 'OPEN')).toBe(false);
    expect(canTransition('COMPLETED', 'REVISION_REQUESTED')).toBe(false);
  });
});

describe('cancellation rules', () => {
  it('allows cancelling up to and including CONFIRMED', () => {
    expect(canCancel('DRAFT')).toBe(true);
    expect(canCancel('OPEN')).toBe(true);
    expect(canCancel('CONFIRMED')).toBe(true);
  });

  // Spec: no refund once the commission is paid, and no cancellation at all
  // once the advance has gone out.
  it('blocks cancelling once money has moved', () => {
    expect(canCancel('COMMISSION_PAID')).toBe(false);
    expect(canCancel('ADVANCE_PAID')).toBe(false);
    expect(canCancel('CONTENT_UPLOADED')).toBe(false);
    expect(canCancel('COMPLETED')).toBe(false);
  });

  it('explains why a blocked cancellation was refused', () => {
    expect(cancellationBlockedReason('COMMISSION_PAID')).toMatch(/non-refundable/);
    expect(cancellationBlockedReason('ADVANCE_PAID')).toMatch(/advance/i);
    expect(cancellationBlockedReason('OPEN')).toBeNull();
  });
});

describe('application window', () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();

  it('is open only on an OPEN deal before its deadline', () => {
    expect(applicationsOpen({ workflow_status: 'OPEN', application_deadline: future })).toBe(true);
    expect(applicationsOpen({ workflow_status: 'OPEN', application_deadline: past })).toBe(false);
    expect(applicationsOpen({ workflow_status: 'CONFIRMED', application_deadline: future })).toBe(false);
  });

  it('honours the closed flag even before the deadline', () => {
    expect(
      applicationsOpen({
        workflow_status: 'OPEN',
        application_deadline: future,
        applications_closed: true,
      })
    ).toBe(false);
  });
});
