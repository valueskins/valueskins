// What an account still has to fill in before it can post a deal or apply to
// one. One definition, used by the page gates, the API and the screens that
// show the checklist, so they cannot disagree about what "complete" means.
//
// Everything on the Settings page is required for the role that sees it, with
// two exceptions: a brand's website is optional, and a brand's UPI ID is not
// required because nothing pays a brand.

export type SetupItem = 'profile' | 'email' | 'email_confirm' | 'upi' | 'about';

export interface SetupRow {
  role: string | null;
  email: string | null;
  email_verified: boolean | null;
  profile_locked_at: unknown;
  pitch_text: string | null;
  payout_vpa: string | null;
  payout_name: string | null;
}

/** The columns `missingSetup` reads, for use in a SELECT. */
export const SETUP_COLUMNS =
  'role, email, email_verified, profile_locked_at, pitch_text, payout_vpa, payout_name';

export const SETUP_LABELS: Record<'creator' | 'brand', Record<SetupItem, string>> = {
  creator: {
    profile: 'Fill in your profile',
    email: 'Add your email address',
    email_confirm: 'Confirm your email address',
    upi: 'Add your UPI ID and the name on the account',
    about: 'Write why brands should hire you',
  },
  brand: {
    profile: 'Fill in your brand profile',
    email: 'Add your email address',
    email_confirm: 'Confirm your email address',
    upi: 'Add your UPI ID',
    about: 'Write about your brand',
  },
};

/** The items this role has to complete, in the order they appear in Settings. */
export function requiredSetup(role: string | null): SetupItem[] {
  return role === 'brand'
    ? ['profile', 'email', 'email_confirm', 'about']
    : ['profile', 'email', 'email_confirm', 'upi', 'about'];
}

export function missingSetup(u: SetupRow | null | undefined): SetupItem[] {
  if (!u) return ['profile', 'email'];
  const done: Record<SetupItem, boolean> = {
    profile: !!u.profile_locked_at,
    email: !!u.email,
    // Not reported as a second problem while there is no address at all.
    email_confirm: !u.email || !!u.email_verified,
    upi: !!u.payout_vpa && !!u.payout_name,
    about: !!(u.pitch_text && u.pitch_text.trim()),
  };
  return requiredSetup(u.role).filter((item) => !done[item]);
}

export function setupMessage(role: string | null, missing: SetupItem[], action: string): string {
  const labels = SETUP_LABELS[role === 'brand' ? 'brand' : 'creator'];
  const first = labels[missing[0]];
  const more = missing.length - 1;
  return `Finish setting up your account in Settings before ${action}. Still to do: ${first.toLowerCase()}${
    more > 0 ? `, and ${more} more` : ''
  }.`;
}
