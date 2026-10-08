// One-tap UPI payment and a scannable QR, both built from the saved UPI ID.
//
// The point is that nobody retypes the ID: a mistyped UPI ID sends money to a
// stranger and cannot be recalled. On a phone the link opens the brand's UPI
// app with the payee and amount filled in; on a computer they scan the QR with
// the phone. Either way the UPI app shows the registered payee name before it
// asks for the PIN, which is what the brand is told to check.
import { useEffect, useState } from 'react';
import { C } from '@/theme/colors';

/** `upi://pay` deep link, per the NPCI UPI linking specification. */
export function upiPayLink(args: { vpa: string; name?: string; amount: number; note: string }): string {
  // Built by hand rather than with URLSearchParams, which writes a space as
  // "+". UPI apps do not all read that back as a space, so a payee name would
  // show as "Rahul+Sharma". encodeURIComponent writes %20, which they all do.
  const enc = encodeURIComponent;
  const parts = [
    // The "@" stays literal: it is how every UPI app expects the address.
    `pa=${enc(args.vpa).replace(/%40/g, '@')}`,
    `pn=${enc(args.name || args.vpa)}`,
    `am=${(Number(args.amount) || 0).toFixed(2)}`,
    'cu=INR',
    `tn=${enc(args.note.slice(0, 50))}`,
  ];
  return `upi://pay?${parts.join('&')}`;
}

export default function UpiPayButton({
  vpa, name, amount, note,
}: { vpa: string; name?: string; amount: number; note: string }) {
  const link = upiPayLink({ vpa, name, amount, note });
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    // Loaded on demand: only a brand at a payment step ever needs it.
    import('qrcode')
      .then((m: any) => (m.default || m).toDataURL(link, { margin: 1, width: 180, errorCorrectionLevel: 'M' }))
      .then((url: string) => { if (live) setQr(url); })
      .catch(() => { if (live) setQr(null); });
    return () => { live = false; };
  }, [link]);

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qr}
          alt="UPI QR code for this payment"
          width={120}
          height={120}
          style={{ borderRadius: 8, background: '#fff', padding: 4 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 160 }}>
        <a
          href={link}
          style={{
            display: 'inline-block', background: C.primary, color: C.onPrimary,
            borderRadius: 8, padding: '11px 14px', fontWeight: 600, fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Pay in UPI app
        </a>
        <div style={{ fontSize: 11, color: C.outline, lineHeight: 1.5, marginTop: 8 }}>
          On a phone, tap the button. On a computer, scan the code with your UPI app.
        </div>
      </div>
    </div>
  );
}
