import { withAlpha } from '@/theme/colors';
import { useEffect, useMemo, useState } from 'react';

const C = {
  bg: '#0a0e1a',
  surface: '#111827',
  surfaceAlt: '#1a2332',
  border: 'rgba(184, 180, 172, 0.15)',
  text: '#f1f5f9',
  muted: '#B8B4AC',
  accent: '#C8B89A',
  success: 'var(--c-accent)',
  warning: '#facc15',
  error: '#f87171',
  gold: 'var(--c-warning)',
};

interface LedgerEntry {
  id: string;
  timestamp: string;
  type: 'payment' | 'escrow' | 'payout' | 'refund' | 'transfer';
  description: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  reference: string;
}

function useFakeBankLedger() {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('fake_bank_ledger');
    if (stored) {
      try { setLedger(JSON.parse(stored)); }
      catch { setLedger([]); }
    }
    setLoaded(true);
  }, []);

  const save = (entries: LedgerEntry[]) => {
    localStorage.setItem('fake_bank_ledger', JSON.stringify(entries));
    setLedger(entries);
  };

  const addEntry = (entry: LedgerEntry) => {
    const updated = [entry, ...ledger];
    save(updated);
  };

  const clear = () => save([]);

  const balance = useMemo(() => {
    let totalIn = 0, totalOut = 0;
    for (const e of ledger) {
      if (e.status !== 'completed') continue;
      if (e.type === 'payment' || e.type === 'escrow') totalIn += e.amount;
      else if (e.type === 'payout' || e.type === 'refund') totalOut += e.amount;
    }
    return { totalIn, totalOut, net: totalIn - totalOut };
  }, [ledger]);

  const byType = (type?: string) =>
    type && type !== 'all' ? ledger.filter(e => e.type === type) : ledger;

  return { ledger, addEntry, clear, balance, byType, loaded };
}

const FAKE_ACCOUNT = {
  bankName: 'ValueSkins Federal Credit',
  routing: '021000021',
  accountNumber: '40987234',
  branch: 'Mumbai, Fort',
  swift: 'VSKNINBB',
};

export default function FakeBankPage() {
  const { ledger, addEntry, clear, balance, byType, loaded } = useFakeBankLedger();
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState('');

  const filtered = byType(filter);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const receiptLabel = (receipt: string) => {
    if (receipt.startsWith('vs_')) return 'ValueSkin Purchase';
    if (receipt.startsWith('escrow_')) return 'Escrow Deposit';
    if (receipt.startsWith('payout_')) return 'Creator Payout';
    if (receipt.startsWith('refund_')) return 'Refund';
    return receipt;
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'payment': return C.success;
      case 'escrow': return C.accent;
      case 'payout': return C.warning;
      case 'refund': return C.error;
      case 'transfer': return C.muted;
      default: return C.muted;
    }
  };

  const typeBadge = (type: string) => {
    const labels: Record<string, string> = {
      payment: 'Payment',
      escrow: 'Escrow',
      payout: 'Payout',
      refund: 'Refund',
      transfer: 'Transfer',
    };
    return (
      <span style={{
        display: 'inline-block', padding: '3px 8px', borderRadius: '6px',
        fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
        background: `${typeColor(type)}15`, color: typeColor(type),
        border: `1px solid ${typeColor(type)}30`,
      }}>
        {labels[type] || type}
      </span>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", paddingBottom: 40 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #C8B89A, var(--c-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#0a0e1a' }}>V</div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Fake Bank</h1>
            </div>
            <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>Payment Simulation Dashboard, all amounts are test/simulated</p>
          </div>
          <button onClick={clear} style={{
            padding: '8px 16px', background: 'rgba(248,113,113,0.1)', border: `1px solid ${withAlpha(C.error, 0x30)}`,
            borderRadius: 8, color: C.error, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            Clear All Records
          </button>
        </div>

        {/* Balance Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Total Received', value: `₹${(balance.totalIn / 100).toLocaleString('en-IN')}`, color: C.success },
            { label: 'Total Paid Out', value: `₹${(balance.totalOut / 100).toLocaleString('en-IN')}`, color: C.warning },
            { label: 'Net Balance', value: `₹${(balance.net / 100).toLocaleString('en-IN')}`, color: balance.net >= 0 ? C.success : C.error },
            { label: 'Total Transactions', value: String(ledger.length), color: C.accent },
          ].map(s => (
            <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Account Details */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 28, display: 'flex', flexWrap: 'wrap', gap: '20px 32px' }}>
          {[
            { label: 'Bank', value: FAKE_ACCOUNT.bankName },
            { label: 'Routing', value: FAKE_ACCOUNT.routing, copy: FAKE_ACCOUNT.routing },
            { label: 'Account', value: FAKE_ACCOUNT.accountNumber, copy: FAKE_ACCOUNT.accountNumber },
            { label: 'Branch', value: FAKE_ACCOUNT.branch },
            { label: 'SWIFT', value: FAKE_ACCOUNT.swift, copy: FAKE_ACCOUNT.swift },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 2, cursor: f.copy ? 'pointer' : 'default' }} onClick={() => f.copy && copyToClipboard(f.copy, f.label)}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{f.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                {f.value}
                {f.copy && (
                  <span style={{ fontSize: 10, color: copied === f.label ? C.success : C.muted }}>
                    {copied === f.label ? '✓' : '📋'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {['all', 'payment', 'escrow', 'payout', 'refund', 'transfer'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '8px 16px', borderRadius: 8, border: `1px solid ${filter === f ? typeColor(f === 'all' ? 'payment' : f) : C.border}`,
              background: filter === f ? `${typeColor(f === 'all' ? 'payment' : f)}15` : 'transparent',
              color: filter === f ? typeColor(f === 'all' ? 'payment' : f) : C.muted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
            }}>
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>

        {/* Ledger Table */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Transaction Ledger</span>
            <span style={{ fontSize: 11, color: C.muted }}>{filtered.length} entries</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
              {ledger.length === 0
                ? 'No transactions yet. Buy a ValueSkin or fund escrow to see transactions here.'
                : 'No matching transactions for this filter.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.muted }}>
                    {['Date/Time', 'Type', 'Description', 'Amount', 'Status', 'Reference'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr key={entry.id} style={{ borderBottom: `1px solid ${withAlpha(C.border, 0x20)}` }}>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: C.muted }}>
                        {new Date(entry.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 14px' }}>{typeBadge(entry.type)}</td>
                      <td style={{ padding: '10px 14px', color: C.text, fontWeight: 500 }}>{entry.description}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, whiteSpace: 'nowrap',
                        color: entry.type === 'payment' || entry.type === 'escrow' ? C.success : entry.type === 'payout' || entry.type === 'refund' ? C.error : C.text
                      }}>
                        {(entry.type === 'payment' || entry.type === 'escrow') ? '+' : '-'}₹{(entry.amount / 100).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                          background: entry.status === 'completed' ? `${withAlpha(C.success, 0x15)}` : entry.status === 'pending' ? `${withAlpha(C.warning, 0x15)}` : `${withAlpha(C.error, 0x15)}`,
                          color: entry.status === 'completed' ? C.success : entry.status === 'pending' ? C.warning : C.error,
                        }}>
                          {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: C.muted, fontSize: 11, fontFamily: 'monospace' }}>{entry.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
