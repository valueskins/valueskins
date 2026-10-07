// What counts as an Instagram username, and how one is shown.
//
// `users.username` holds the real Instagram username when Instagram told us
// what it is. When it would not (Meta refuses the profile read for some
// accounts), login stores the placeholder `ig-<numeric id>` instead. The hyphen
// is deliberate: Instagram usernames are letters, digits, dots and underscores,
// so a placeholder can never be mistaken for one, shown as one, or linked.
export const INSTAGRAM_HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

export function isInstagramHandle(username: string | null | undefined): username is string {
  return typeof username === 'string' && INSTAGRAM_HANDLE_RE.test(username);
}

export function placeholderUsername(instagramUserId: string): string {
  return `ig-${instagramUserId}`;
}

/** `@name` for a real username; a neutral label when we do not know it. */
export function handleLabel(username: string | null | undefined): string {
  return isInstagramHandle(username) ? `@${username}` : 'Instagram username unavailable';
}

export function instagramUrl(username: string): string {
  return `https://www.instagram.com/${username}/`;
}
