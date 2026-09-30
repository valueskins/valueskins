// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE OAUTH — COMMENTED OUT (kept for reference, do not delete)
// Replaced by Instagram OAuth (see INSTAGRAM section below). Deliberately left
// here so the Google flow can be restored verbatim if needed.
// ─────────────────────────────────────────────────────────────────────────────
// const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
// const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
// const GOOGLE_REDIRECT_URI = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/oauth/google/callback';
//
// // Debug logging
// if (typeof window !== 'undefined' && !GOOGLE_CLIENT_ID) {
//   console.error('⚠️ GOOGLE_CLIENT_ID is missing! Check Vercel env vars. Current env:', {
//     clientId: GOOGLE_CLIENT_ID,
//     redirectUri: GOOGLE_REDIRECT_URI,
//   });
// }

// ─────────────────────────────────────────────────────────────────────────────
// INSTAGRAM OAUTH (Instagram Login via Meta) — primary identity + verification
// Only Business/Creator Instagram accounts can authorize. No email is returned
// by the API — email is collected during onboarding and confirmed separately.
// ─────────────────────────────────────────────────────────────────────────────

const INSTAGRAM_CLIENT_ID = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID || '';
const INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET || '';
const INSTAGRAM_REDIRECT_URI = process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI || 'http://localhost:3000/api/oauth/instagram/callback';

// Debug logging
if (typeof window !== 'undefined' && !INSTAGRAM_CLIENT_ID) {
  console.error('⚠️ INSTAGRAM_CLIENT_ID is missing! Check Vercel env vars. Current env:', {
    clientId: INSTAGRAM_CLIENT_ID,
    redirectUri: INSTAGRAM_REDIRECT_URI,
  });
}

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_REDIRECT_URI = process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI || 'http://localhost:3000/api/oauth/github/callback';

function randomState(): string {
  const arr = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(arr);
  } else {
    // Server-side fallback
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE OAUTH — COMMENTED OUT (kept for reference, do not delete)
// Server-side URL construction — client should fetch /api/oauth/start/google.
// ─────────────────────────────────────────────────────────────────────────────
// export async function getGoogleAuthUrl(): Promise<string> {
//   if (typeof window === 'undefined') {
//     // Server-side: construct directly
//     const params = new URLSearchParams({
//       client_id: GOOGLE_CLIENT_ID,
//       redirect_uri: GOOGLE_REDIRECT_URI,
//       response_type: 'code',
//       // Sign-in asks for identity only. The Calendar scopes are "sensitive" in
//       // Google's terms: requesting them forces the app through Google's
//       // verification review and shows every user the "Google hasn't verified
//       // this app" interstitial. openid/profile/email need no verification.
//       // If Calendar returns, request it separately at the point of use
//       // (incremental auth) rather than at login.
//       scope: 'openid profile email',
//       state: randomState(),
//       access_type: 'offline',
//       prompt: 'select_account',
//     });
//     return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
//   }
//   // Client-side: fetch from server endpoint to ensure env vars are correct
//   const res = await fetch('/api/oauth/start/google');
//   const data = await res.json();
//   return data.url;
// }

// Instagram Login — build the authorization URL. Client fetches
// /api/oauth/start/instagram so the state cookie is set server-side; this
// server-side branch exists for parity with the old Google helper.
//
// Scope: instagram_business_basic (identity + read own profile/media).
// Add instagram_business_manage_insights only once the app has Advanced Access.
export async function getInstagramAuthUrl(): Promise<string> {
  if (typeof window === 'undefined') {
    const params = new URLSearchParams({
      client_id: INSTAGRAM_CLIENT_ID,
      redirect_uri: INSTAGRAM_REDIRECT_URI,
      response_type: 'code',
      scope: 'instagram_business_basic',
      state: randomState(),
    });
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  }
  const res = await fetch('/api/oauth/start/instagram');
  const data = await res.json();
  return data.url;
}

export function getGitHubAuthUrl(): string {
  const state = randomState();
  const scope = 'user:email';
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope,
    state,
  });

  if (typeof window !== 'undefined') {
    sessionStorage.setItem('oauth_state', state);
  }

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE OAUTH — COMMENTED OUT (kept for reference, do not delete)
// ─────────────────────────────────────────────────────────────────────────────
// export async function exchangeGoogleCode(code: string): Promise<any> {
//   const params = new URLSearchParams({
//     client_id: GOOGLE_CLIENT_ID,
//     client_secret: GOOGLE_CLIENT_SECRET,
//     code,
//     grant_type: 'authorization_code',
//     redirect_uri: GOOGLE_REDIRECT_URI,
//   });
//
//   const response = await fetch('https://oauth2.googleapis.com/token', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//     body: params.toString(),
//   });
//
//   if (!response.ok) {
//     // Surface Google's actual reason instead of a blank "failed". Google returns
//     // e.g. { error: "invalid_client" } (bad/missing secret),
//     // "invalid_grant" (code reused/expired), or "redirect_uri_mismatch".
//     // Logged server-side only; never returned to the browser (it can carry
//     // sensitive detail). This changes only the failure path — a successful
//     // exchange still returns response.json() unchanged.
//     const detail = await response.text().catch(() => '');
//     console.error('[oauth] Google token exchange failed', {
//       status: response.status,
//       // don't log the secret, only whether it was present
//       hasClientSecret: Boolean(GOOGLE_CLIENT_SECRET),
//       redirectUri: GOOGLE_REDIRECT_URI,
//       google: detail.slice(0, 500),
//     });
//     throw new Error('Google token exchange failed');
//   }
//   return response.json();
// }

// Instagram Login — exchange the authorization code for a short-lived token.
// POST https://api.instagram.com/oauth/access_token (form-encoded).
// Response: { access_token, user_id, permissions }.
export async function exchangeInstagramCode(code: string): Promise<any> {
  const params = new URLSearchParams({
    client_id: INSTAGRAM_CLIENT_ID,
    client_secret: INSTAGRAM_CLIENT_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: INSTAGRAM_REDIRECT_URI,
    code,
  });

  console.log('[oauth] Exchanging Instagram code', {
    clientId: INSTAGRAM_CLIENT_ID.slice(0, 8) + '...',
    redirectUri: INSTAGRAM_REDIRECT_URI,
    hasCode: !!code,
    hasSecret: !!INSTAGRAM_CLIENT_SECRET,
  });

  const response = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    let errorData = null;
    try {
      errorData = JSON.parse(detail)?.error;
    } catch (e) {
      // Detail is plain text, not JSON
    }

    console.error('[oauth] Instagram token exchange failed', {
      status: response.status,
      statusText: response.statusText,
      hasClientSecret: Boolean(INSTAGRAM_CLIENT_SECRET),
      clientId: INSTAGRAM_CLIENT_ID.slice(0, 8) + '...',
      redirectUri: INSTAGRAM_REDIRECT_URI,
      errorCode: errorData?.code,
      errorMessage: errorData?.message || detail.slice(0, 500),
      fullResponse: detail.slice(0, 500),
    });
    throw new Error(`Instagram token exchange failed: ${response.status} ${errorData?.message || detail.slice(0, 100)}`);
  }
  return response.json();
}

// Instagram Login — swap the short-lived token (1h) for a long-lived one (60d).
// GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token
export async function exchangeInstagramLongLivedToken(shortLivedToken: string): Promise<any> {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: INSTAGRAM_CLIENT_SECRET,
    access_token: shortLivedToken,
  });

  const response = await fetch(`https://graph.instagram.com/access_token?${params.toString()}`);

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('[oauth] Instagram long-lived token exchange failed', {
      status: response.status,
      instagram: detail.slice(0, 500),
    });
    // Non-fatal: caller can fall back to the short-lived token.
    throw new Error('Instagram long-lived token exchange failed');
  }
  return response.json();
}

export async function exchangeGitHubCode(code: string): Promise<any> {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    client_secret: GITHUB_CLIENT_SECRET,
    code,
    redirect_uri: GITHUB_REDIRECT_URI,
  });

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) throw new Error('GitHub token exchange failed');
  return response.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE OAUTH — COMMENTED OUT (kept for reference, do not delete)
// ─────────────────────────────────────────────────────────────────────────────
// export async function getGoogleUserInfo(accessToken: string): Promise<any> {
//   const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
//     headers: { Authorization: `Bearer ${accessToken}` },
//   });
//
//   if (!response.ok) throw new Error('Failed to fetch Google user info');
//   return response.json();
// }

// Instagram Login — fetch the authorized account's profile. This is also the
// verification signal: a successful call with this token proves the user
// controls the Instagram account.
//
// NOTE: this app uses the "Instagram API with Instagram Login" flow
// (Business Login: authorize at www.instagram.com/oauth/authorize, exchange
// at api.instagram.com/oauth/access_token -> "Instagram User" access token).
// For that flow the DOCUMENTED profile endpoint is `graph.instagram.com/me`
// with fields `user_id,username` (see Meta "Get Started" guide), NOT the
// numeric IG node. It returns:
//   - `id`      -> app-scoped user id
//   - `user_id` -> the Instagram professional account ID (used everywhere
//                  else in this codebase: sync.ts, webhooks, /{id} lookups)
//   - `username`, `name`, `account_type` ("Business" | "Media_Creator"),
//     `profile_picture_url`, `followers_count`, `media_count`
//
// A 400 "Unsupported request - method type: get" (IGApiException code 100)
// is a Meta app-level / account-level rejection, not an endpoint bug. It
// means the access token is not allowed to read this account: the Meta app
// must be app type "Business"; the logging-in account must either be added
// as a tester/role (Standard Access) OR the app must hold App Review +
// Advanced Access + Business Verification. Creator accounts without a
// connected Facebook Page also hit this error on every graph.instagram.com
// call.
export async function getInstagramUserInfo(accessToken: string): Promise<any> {
  // Analytics fields (followers_count, media_count) and profile_picture_url can
  // be denied depending on the token's granted scopes. Identity + account_type
  // are what login and role detection actually need, so degrade gracefully:
  // try the richest field set and drop fields until the call succeeds.
  const fieldSets = [
    'id,user_id,username,name,account_type,profile_picture_url,followers_count,media_count',
    'id,user_id,username,name,account_type,profile_picture_url',
    'id,user_id,username,account_type',
    'id,user_id,username',
    'id,username',
  ];

  let lastError = '';
  for (const fields of fieldSets) {
    const params = new URLSearchParams({ fields, access_token: accessToken });
    const response = await fetch(
      `https://graph.instagram.com/me?${params.toString()}`
    );
    if (response.ok) return response.json();
    lastError = `${response.status} ${await response.text().catch(() => '')}`;
  }

  console.error('[oauth] Instagram user info failed for all field sets', {
    instagram: lastError.slice(0, 500),
  });
  throw new Error(`Failed to fetch Instagram user info (${lastError.slice(0, 300)})`);
}

export function parseOAuthState(state: string): { role: string; csrf: string } {
  const parts = state.split('_');
  const role = parts[0] === 'brand' ? 'brand' : 'creator';
  const csrf = parts.slice(1).join('_');
  return { role, csrf };
}

export async function getGitHubUserInfo(accessToken: string): Promise<any> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) throw new Error('Failed to fetch GitHub user info');
  return response.json();
}
