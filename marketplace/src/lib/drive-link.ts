// Is a Google Drive or Docs link open to anyone who has it?
//
// A creator delivers content as a Drive link. If the link is private, the
// brand opens it, hits "You need access", and the two of them lose a round of
// emails sorting it out. Checking at the moment the creator submits the link
// catches it while they are still on the page and can fix it in a few seconds.
//
// The check opens the link the way a signed-out stranger would. Google answers
// 200 for a link anyone can view, sends a private one to its sign-in page, and
// answers 404 for a link that does not exist.

export type DriveLinkStatus = 'public' | 'private' | 'missing' | 'unknown';

// Only ever requested: the two hosts a content link is allowed to be on.
// Redirects are followed by hand so that nothing here can be steered to
// another host.
const DRIVE_HOSTS = new Set(['drive.google.com', 'docs.google.com']);
const SIGN_IN_HOSTS = new Set(['accounts.google.com']);
const MAX_HOPS = 4;
const TIMEOUT_MS = 6000;

// What Google's own "you cannot see this" pages say, for the cases where it
// answers 200 with a wall instead of redirecting.
const WALL = /<title>[^<]*(Sign[ -]in|Access denied|You need access|Request access)[^<]*<\/title>/i;

export async function checkDriveLink(
  rawUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<DriveLinkStatus> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return 'missing';
  }

  try {
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      if (url.protocol !== 'https:' || !DRIVE_HOSTS.has(url.hostname)) return 'unknown';

      const res = await fetchImpl(url.toString(), {
        method: 'GET',
        redirect: 'manual',
        // Sent with no cookies and no credentials: this is the stranger's view.
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ValueSkinsLinkCheck/1.0)', Accept: 'text/html' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return 'unknown';
        const next = new URL(location, url);
        // Being sent to sign in is exactly what "private" means.
        if (SIGN_IN_HOSTS.has(next.hostname)) return 'private';
        url = next;
        continue;
      }

      if (res.status === 200) {
        // Read only the start of the page; the title is all that is needed.
        const head = (await res.text()).slice(0, 20000);
        return WALL.test(head) ? 'private' : 'public';
      }
      if (res.status === 401 || res.status === 403) return 'private';
      if (res.status === 404 || res.status === 410) return 'missing';
      // 429, 5xx, or anything else: Google did not give a straight answer.
      return 'unknown';
    }
    return 'unknown';
  } catch {
    // Timed out or unreachable. Not the creator's fault, so not held against
    // the link.
    return 'unknown';
  }
}

export const DRIVE_LINK_MESSAGES: Record<'private' | 'missing', string> = {
  private:
    'This link is private. Open it in Google Drive, choose Share, set General access to "Anyone with the link", then submit it again.',
  missing:
    'This link does not open. Check that you copied the whole link from Google Drive, then submit it again.',
};
