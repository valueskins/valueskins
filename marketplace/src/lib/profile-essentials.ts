// Shared rules for the profile essentials shown on the virtual resume.

export const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'] as const;
export type Gender = (typeof GENDERS)[number];

export const MIN_AGE = 18;
export const MAX_AGE = 99;
export const MAX_FOLLOWERS = 1_000_000_000;

// The age someone gave, advanced by the whole years since they gave it. Written
// as SQL so every query that shows an age computes it the same way.
export const CURRENT_AGE_SQL =
  `CASE WHEN age IS NULL OR age_recorded_at IS NULL THEN NULL
        ELSE age + EXTRACT(YEAR FROM age(NOW(), age_recorded_at))::int END`;

// Login writes a stand-in display name until the user gives a real one.
export function isPlaceholderName(name: string | null | undefined): boolean {
  return !name || /^(@|IG User |Instagram user$)/.test(name);
}
