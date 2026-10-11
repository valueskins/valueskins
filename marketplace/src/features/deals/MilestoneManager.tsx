'use client';
import { withAlpha } from '@/theme/colors';
import { useState, useEffect } from 'react';

const C = {
  bg: '#0A0A0A', surface: '#1A1A1A', surfaceAlt: '#2D2D2D',
  text: '#F5F5F0', textMuted: '#B8B4AC', primary: '#C8B89A',
  success: 'var(--c-accent)', warning: 'var(--c-warning)', danger: 'var(--c-error)', border: 'var(--c-border)',
};

const STATUS_COLORS: Record<string, string> = {
  pending: C.warning,
  in_progress: C.primary,
  completed: C.success,
};

interface Milestone {
  id: number; deal_id: number; title: string; description?: string;
  amount: string; status: string; due_date?: string; completed_at?: string;
}

export default function MilestoneManager({ dealId, isCreator }: { dealId: number; isCreator: boolean }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMs, setNewMs] = useState({ title: '', description: '', amount: '', due_date: '' });
  const [saving, setSaving] = useState(false);

  const fetchMilestones = async () => {
    try {
      const res = await fetch(`/api/deals/milestones?deal_id=${dealId}`, { credentials: 'include' });
      if (res.ok) setMilestones((await res.json()).milestones || []);
      else setError('Failed to load milestones');
    } catch { setError('Network error'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchMilestones(); }, [dealId]);

  const addMilestone = async () => {
    if (!newMs.title || !newMs.amount) return;
    setSaving(true);
    try {
      const res = await fetch('/api/deals/milestones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          deal_id: dealId,
          milestones: [{ title: newMs.title, description: newMs.description, amount: newMs.amount, due_date: newMs.due_date || null }],
        }),
      });
      if (res.ok) { setNewMs({ title: '', description: '', amount: '', due_date: '' }); fetchMilestones(); }
      else { const d = await res.json(); setError(d.error || 'Failed'); }
    } catch { setError('Network error'); } finally { setSaving(false); }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch('/api/deals/milestones', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ milestone_id: id, status }),
      });
      if (res.ok) fetchMilestones();
      else { const d = await res.json(); setError(d.error || 'Failed'); }
    } catch { setError('Network error'); }
  };

  if (loading) return <div style={{ color: C.textMuted, fontSize: '13px' }}>Loading milestones...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: C.text }}>Milestones</h3>
        {!isCreator && (
          <button onClick={() => setNewMs({ title: '', description: '', amount: '', due_date: '' })}
            style={{ padding: '4px 10px', background: C.primary, color: 'var(--c-on-primary)', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>
            + Add
          </button>
        )}
      </div>

      {error && <div style={{ padding: '8px', background: `${withAlpha(C.danger, 0x20)}`, borderRadius: '4px', fontSize: '12px', color: C.danger, marginBottom: '10px' }}>{error}</div>}

      {milestones.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: C.textMuted, fontSize: '13px' }}>No milestones yet.</div>
      ) : (
        <div style={{ display: 'grid', gap: '8px' }}>
          {milestones.map((m) => (
            <div key={m.id} style={{ padding: '10px', background: C.surface, borderRadius: '6px', border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{m.title}</div>
                  {m.description && <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '2px' }}>{m.description}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', color: C.text, fontWeight: 600 }}>${m.amount}</div>
                  <div style={{
                    fontSize: '11px', padding: '2px 6px', borderRadius: '3px',
                    background: `${STATUS_COLORS[m.status] || C.textMuted}20`,
                    color: STATUS_COLORS[m.status] || C.textMuted,
                    textTransform: 'capitalize', marginTop: '4px',
                  }}>{m.status.replace(/_/g, ' ')}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                {isCreator && m.status === 'pending' && (
                  <button onClick={() => updateStatus(m.id, 'in_progress')} style={{ padding: '4px 8px', background: C.primary, color: 'var(--c-on-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>Start</button>
                )}
                {m.status === 'in_progress' && (
                  <button onClick={() => updateStatus(m.id, 'completed')} style={{ padding: '4px 8px', background: C.success, color: 'var(--c-on-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>Complete</button>
                )}
                {m.due_date && <span style={{ fontSize: '11px', color: C.textMuted, marginLeft: 'auto' }}>Due: {new Date(m.due_date).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline add form for brand */}
      {!isCreator && (
        <div style={{ marginTop: '12px', display: 'grid', gap: '8px', padding: '12px', background: C.surface, borderRadius: '6px', border: `1px dashed ${C.border}` }}>
          <input placeholder="Milestone title" value={newMs.title} onChange={e => setNewMs({ ...newMs, title: e.target.value })}
            style={{ padding: '8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '4px', color: C.text, fontSize: '13px' }} />
          <input placeholder="Description (optional)" value={newMs.description} onChange={e => setNewMs({ ...newMs, description: e.target.value })}
            style={{ padding: '8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '4px', color: C.text, fontSize: '13px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <input type="number" step="0.01" placeholder="Amount ($)" value={newMs.amount} onChange={e => setNewMs({ ...newMs, amount: e.target.value })}
              style={{ padding: '8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '4px', color: C.text, fontSize: '13px' }} />
            <input type="date" value={newMs.due_date} onChange={e => setNewMs({ ...newMs, due_date: e.target.value })}
              style={{ padding: '8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '4px', color: C.text, fontSize: '13px' }} />
          </div>
          <button onClick={addMilestone} disabled={saving || !newMs.title || !newMs.amount}
            style={{ padding: '8px', background: C.primary, color: 'var(--c-on-primary)', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '13px', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Adding...' : 'Add Milestone'}
          </button>
        </div>
      )}
    </div>
  );
}
