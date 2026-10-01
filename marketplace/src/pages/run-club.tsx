// Run Club — a public page, no auth, no forms.
//
// Registration is the payment itself: the Razorpay payment page collects the
// name and phone, and attendance is checked against the Razorpay transaction
// list at the gate. There is deliberately no form here, so there is no second
// list to reconcile against the first.
//
// Styled from the shared theme tokens rather than its own colours, so it follows
// BRANDING §4 and the light/dark setting like the rest of the site.
import Head from 'next/head';
import { C, withAlpha } from '@/theme/colors';

const PAYMENT_URL = 'https://rzp.io/rzp/6GICUS4';
const MAP_EMBED =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3783.1278892777996!2d73.84097799999999!3d18.523122!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2bf80b1612b0b%3A0xffbe7f54147ff1ab!2sFerguson%20College%20Main%20Gate!5e0!3m2!1sen!2sin!4v1790839028053!5m2!1sen!2sin';
// Opens the real Maps app on a phone, which the embed cannot do.
const MAP_LINK = 'https://maps.google.com/?q=Ferguson+College+Main+Gate,+Pune';

const PRICE = 49;

const DETAILS: [string, string][] = [
  ['When', 'Saturday, 11 October · 7:00 AM'],
  ['Where', 'Ferguson College Main Gate, Pune'],
  ['Distance', '5K, at your own pace'],
  ['Cost', `₹${PRICE}`],
];

export default function RunClubPage() {
  const wrap: React.CSSProperties = { maxWidth: 680, margin: '0 auto', padding: '0 16px' };

  return (
    <>
      <Head>
        <title>Run Club — ValueSkins</title>
        <meta
          name="description"
          content="ValueSkins Run Club. Saturday 11 October, 7:00 AM, Ferguson College Main Gate, Pune. 5K at your own pace, all levels welcome."
        />
        {/* Link previews do most of the work when this is shared on WhatsApp. */}
        <meta property="og:title" content="ValueSkins Run Club — Saturday 11 October, 7 AM" />
        <meta
          property="og:description"
          content="5K at your own pace from Ferguson College Main Gate, Pune. Walkers and first-timers welcome."
        />
      </Head>

      <main style={{ minHeight: '100vh', background: C.bg, color: C.text, paddingBottom: 56 }}>
        {/* Header */}
        <section style={{ borderBottom: `1px solid ${C.border}`, padding: '56px 0 40px' }}>
          <div style={wrap}>
            <div
              style={{
                fontSize: 11, fontWeight: 700, color: C.accent,
                textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: 14,
              }}
            >
              ValueSkins Run Club
            </div>
            <h1
              style={{
                fontSize: 'clamp(30px, 7vw, 48px)',
                lineHeight: 1.08, fontWeight: 700, margin: '0 0 14px', letterSpacing: '-0.5px',
              }}
            >
              Saturday morning run.
            </h1>
            <p style={{ fontSize: 16, color: C.textMuted, margin: 0, lineHeight: 1.6, maxWidth: 460 }}>
              5K at your own pace. All levels welcome — walkers, first-timers, and people who
              have not run since school.
            </p>
            <p
              style={{
                fontSize: 13, color: C.outline, margin: '14px 0 0',
                lineHeight: 1.6, maxWidth: 460, fontStyle: 'italic',
              }}
            >
              ₹{PRICE}. We are the cheapest run club (probably — first time, don&apos;t judge).
            </p>
          </div>
        </section>

        {/* Details */}
        <section style={{ padding: '32px 0' }}>
          <div style={wrap}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 1,
                background: C.border,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              {DETAILS.map(([k, v]) => (
                <div key={k} style={{ background: C.surface, padding: '16px 18px' }}>
                  <div
                    style={{
                      fontSize: 10, fontWeight: 700, color: C.outline,
                      textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6,
                    }}
                  >
                    {k}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{v}</div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 14, color: C.textMuted, margin: '20px 0 0', lineHeight: 1.6 }}>
              Bring water. Wear something you can run in.
            </p>
          </div>
        </section>

        {/* Pay to confirm */}
        <section style={{ padding: '8px 0 32px' }}>
          <div style={wrap}>
            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.accent}`,
                borderRadius: 12,
                padding: 22,
              }}
            >
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>
                Confirm your spot
              </h2>
              <p style={{ fontSize: 13, color: C.textMuted, margin: '0 0 16px', lineHeight: 1.6 }}>
                ₹{PRICE}. Paying is how you register — there is no separate form. We check
                you off at the gate, so bring the phone number you pay with.
              </p>

              <a
                href={PAYMENT_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  background: C.primary,
                  color: C.onPrimary,
                  fontWeight: 700,
                  fontSize: 15,
                  padding: '14px 26px',
                  borderRadius: 8,
                  textDecoration: 'none',
                }}
              >
                Pay ₹{PRICE} and join the run
              </a>

              <p style={{ fontSize: 11, color: C.outline, margin: '14px 0 0' }}>
                Payments are handled by Razorpay. No refunds.
              </p>
            </div>
          </div>
        </section>

        {/* Where */}
        <section style={{ padding: '8px 0 0' }}>
          <div style={wrap}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>Where we meet</h2>
            <p style={{ fontSize: 13, color: C.textMuted, margin: '0 0 14px' }}>
              Ferguson College Main Gate, Pune.{' '}
              <a
                href={MAP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: C.primary }}
              >
                Open in Maps
              </a>
            </p>

            <div
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                overflow: 'hidden',
                // Ratio box rather than a fixed height: the original embed was
                // 600x450, which overflows a phone.
                position: 'relative',
                paddingTop: '62%',
                background: C.surfaceAlt,
              }}
            >
              <iframe
                src={MAP_EMBED}
                title="Map showing Ferguson College Main Gate, Pune"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%', border: 0,
                }}
              />
            </div>
          </div>
        </section>

        <footer style={{ ...wrap, marginTop: 40, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 11, color: C.outline, margin: 0 }}>
            ValueSkins Run Club · Pune
          </p>
        </footer>
      </main>
    </>
  );
}
