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
