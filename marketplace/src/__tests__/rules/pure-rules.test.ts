/**
 * @jest-environment node
 *
 * The rules that have no database behind them. Each of these has been wrong in
 * production at least once, so each is pinned here.
 */
import { roleFromInstagramAccountType } from '@/lib/oauth';
import { isInstagramHandle, handleLabel, placeholderUsername } from '@/lib/handle';
import { scrubText, scrubEvent } from '@/lib/sentry-scrub';
import { financials } from '@/lib/deal-api';
import { missingSetup } from '@/lib/setup-status';
import { checkDriveLink } from '@/lib/drive-link';

describe('role comes from the Instagram account type', () => {
  it('maps a Business account to brand and a Creator account to creator', () => {
    expect(roleFromInstagramAccountType('BUSINESS')).toBe('brand');
    expect(roleFromInstagramAccountType('business')).toBe('brand');
    expect(roleFromInstagramAccountType('MEDIA_CREATOR')).toBe('creator');
    expect(roleFromInstagramAccountType('CREATOR')).toBe('creator');
  });

  // The bug this guards: every account used to fall back to "creator", which
  // let brands browse and apply to deals.
  it('has no default: anything else is no role at all', () => {
    for (const t of ['', 'PERSONAL', 'unknown', ' ', 'BUSINESS_CREATOR']) {
      expect(roleFromInstagramAccountType(t)).toBeNull();
    }
    expect(roleFromInstagramAccountType(undefined as any)).toBeNull();
  });
});

describe('Instagram usernames', () => {
  it('never treats the numeric-id placeholder as a username', () => {
    const p = placeholderUsername('17841400000000000');
    expect(isInstagramHandle(p)).toBe(false);
    expect(handleLabel(p)).not.toContain('@');
  });

  it('accepts real usernames and labels them with @', () => {
    expect(isInstagramHandle('rahul.sharma_01')).toBe(true);
    expect(handleLabel('rahul.sharma_01')).toBe('@rahul.sharma_01');
  });

  it('rejects anything that could not be an Instagram username', () => {
    for (const bad of ['', 'has space', 'a/b', 'x'.repeat(31), 'javascript:alert(1)', null, undefined]) {
      expect(isInstagramHandle(bad as any)).toBe(false);
    }
  });
});

describe('the fee and the split', () => {
  it('charges a flat 885 and splits the rest 30/70', () => {
    const f = financials(10000);
    expect(f.commissionTotal).toBe(885);
    expect(f.creatorTotal).toBe(9115);
    expect(f.advance).toBe(2734.5);
    expect(f.final).toBe(6380.5);
  });

  it('always pays the creator exactly what is left after the fee', () => {
    for (const budget of [1000, 2500, 9999, 12345, 100000, 750000]) {
      const f = financials(budget);
      expect(Math.round((f.advance + f.final) * 100)).toBe(Math.round(f.creatorTotal * 100));
      expect(Math.round((f.creatorTotal + f.commissionTotal) * 100)).toBe(budget * 100);
    }
  });
});

describe('error reports carry no personal data', () => {
  it('removes emails, UPI IDs, session ids and long tokens from text', () => {
    const out = scrubText(
      `failed for a.b@gmail.com paying rahul@okhdfcbank; valueskins_session=abc-123 ${'f'.repeat(64)}`
    );
    expect(out).not.toMatch(/gmail|okhdfcbank|abc-123|f{64}/);
  });

  it('strips identity, cookies, bodies and query strings from an event', () => {
    const ev: any = scrubEvent({
      user: { email: 'a@b.com', ip_address: '1.2.3.4' },
      request: {
        url: 'https://www.valueskins.com/settings/email?token=deadbeef',
        cookies: { s: '1' },
        data: { email: 'q@w.com' },
        headers: { cookie: 'valueskins_session=zz', 'user-agent': 'UA', 'x-forwarded-for': '9.9.9.9' },
      },
      extra: { userId: 7, email: 'p@p.com' },
    } as any);
    expect(ev.user).toBeUndefined();
    expect(ev.request.cookies).toBeUndefined();
    expect(ev.request.data).toBeUndefined();
    expect(ev.request.url).toBe('https://www.valueskins.com/settings/email');
    expect(ev.request.headers).toEqual({ 'user-agent': 'UA' });
    expect(JSON.stringify(ev)).not.toMatch(/@b\.com|@w\.com|@p\.com|9\.9\.9\.9/);
  });
});

describe('a complete account', () => {
  const full = {
    email: 'a@b.com', email_verified: true, profile_locked_at: new Date(),
    pitch_text: 'About', payout_vpa: 'a@okhdfcbank', payout_name: 'A B',
  };

  it('a creator needs profile, confirmed email, UPI ID with name, and a description', () => {
    expect(missingSetup({ ...full, role: 'creator' })).toEqual([]);
    expect(missingSetup({ ...full, role: 'creator', profile_locked_at: null })).toEqual(['profile']);
    expect(missingSetup({ ...full, role: 'creator', email_verified: false })).toEqual(['email_confirm']);
    expect(missingSetup({ ...full, role: 'creator', payout_vpa: '' })).toEqual(['upi']);
    expect(missingSetup({ ...full, role: 'creator', payout_name: '' })).toEqual(['upi']);
    expect(missingSetup({ ...full, role: 'creator', pitch_text: '   ' })).toEqual(['about']);
  });

  it('a brand needs the same, except a UPI ID', () => {
    expect(missingSetup({ ...full, role: 'brand', payout_vpa: '', payout_name: '' })).toEqual([]);
    expect(missingSetup({ ...full, role: 'brand', pitch_text: '' })).toEqual(['about']);
  });

  it('a missing email is reported once, not as two problems', () => {
    expect(missingSetup({ ...full, role: 'brand', email: '', email_verified: false })).toEqual(['email']);
  });

  it('nothing filled in means everything is missing', () => {
    expect(
      missingSetup({
        role: 'creator', email: '', email_verified: false, profile_locked_at: null,
        pitch_text: '', payout_vpa: '', payout_name: '',
      })
    ).toEqual(['profile', 'email', 'upi', 'about']);
  });
});

describe('a delivered Drive link must open for a stranger', () => {
  const LINK = 'https://drive.google.com/file/d/abc/view';
  const reply = (status: number, headers: Record<string, string> = {}, body = '<title>clip.mp4 - Google Drive</title>') =>
    ({ status, headers: { get: (k: string) => headers[k.toLowerCase()] ?? null }, text: async () => body }) as any;
  const check = (...replies: any[]) => {
    const f = jest.fn();
    replies.forEach((r) => f.mockResolvedValueOnce(r));
    return checkDriveLink(LINK, f as any);
  };

  it('a link anyone can view is public', async () => {
    expect(await check(reply(200))).toBe('public');
  });

  it('a link that sends you to Google sign-in is private', async () => {
    expect(await check(reply(302, { location: 'https://accounts.google.com/ServiceLogin?continue=x' }))).toBe('private');
    expect(await check(reply(403))).toBe('private');
    expect(await check(reply(200, {}, '<title>Google Drive: Sign-in</title>'))).toBe('private');
  });

  it('a link that does not exist is missing', async () => {
    expect(await check(reply(404))).toBe('missing');
  });

  it('follows a redirect within Google Drive and judges where it ends', async () => {
    expect(
      await check(reply(302, { location: 'https://drive.google.com/file/d/abc/view?usp=sharing' }), reply(200))
    ).toBe('public');
  });

  it('never follows a redirect to another site', async () => {
    const f = jest.fn().mockResolvedValueOnce(reply(302, { location: 'https://evil.example/steal' }));
    expect(await checkDriveLink(LINK, f as any)).toBe('unknown');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('does not blame the creator when Google cannot be reached', async () => {
    expect(await check(reply(503))).toBe('unknown');
    const f = jest.fn().mockRejectedValueOnce(new Error('timeout'));
    expect(await checkDriveLink(LINK, f as any)).toBe('unknown');
  });
});

describe('old addresses still lead somewhere', () => {
  it('redirects retired pages instead of serving them', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require('../../../next.config.js');
    const redirects: Array<{ source: string; destination: string }> = await config.redirects();
    const to = (src: string) => redirects.find((r) => r.source === src)?.destination;
    // The old create page had no role check at all.
    expect(to('/deals/create')).toBe('/campaigns/create');
    expect(to('/competitors')).toBe('/how-it-works');
    expect(to('/run-club')).toBe('/');
    for (const gone of ['/feed', '/marketplace', '/razorpay-test', '/fake-bank']) {
      expect(to(gone)).toBe('/deals/browse');
    }
  });
});
