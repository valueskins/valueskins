'use client';
import { withAlpha } from '@/theme/colors';
import { useState, useEffect } from 'react';
import PROFESSIONS from '@/lib/professions';
import type { ProfessionCount } from '@/pages/api/creators/count-by-profession';

const C = {
  bg: '#0A0A0A', surface: '#1A1A1A', surfaceAlt: '#2D2D2D',
  text: '#F5F5F0', textMuted: '#B8B4AC', primary: '#C8B89A',
  success: 'var(--c-accent)', border: '#2D2D2D',
};

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
];

const CONTENT_TYPES = ['photo', 'video', 'story', 'live', 'carousel', 'text'];

const CATEGORIES = ['Fashion & Beauty', 'Food', 'Travel', 'Music', 'Tech', 'Education', 'Comedy & Entertainment'] as const;

export default function BriefForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({
    title: '', description: '', campaign_goals: '', target_audience: '',
    budget_range: '', required_niches: [] as string[], required_platforms: [] as string[],
    required_content_types: [] as string[], deadline: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [professionCounts, setProfessionCounts] = useState<Map<string, number>>(new Map());
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    async function loadCounts() {
      try {
        const res = await fetch('/api/creators/count-by-profession');
        if (res.ok) {
          const data: ProfessionCount[] = await res.json();
          const map = new Map<string, number>();
          data.forEach(pc => map.set(pc.profession, pc.count));
          setProfessionCounts(map);
        }
      } catch {
        // silently fail — counts are non-critical
      } finally {
        setLoadingCounts(false);
      }
    }
    loadCounts();
  }, []);

  const toggleNiche = (niche: string) => {
    setForm(prev => ({
      ...prev,
      required_niches: prev.required_niches.includes(niche)
        ? prev.required_niches.filter(n => n !== niche)
        : [...prev.required_niches, niche],
    }));
  };

  const togglePlatform = (pid: string) => {
    setForm({ ...form, required_platforms: form.required_platforms.includes(pid) ? form.required_platforms.filter(p => p !== pid) : [...form.required_platforms, pid] });
  };

  const toggleContent = (ct: string) => {
    setForm({ ...form, required_content_types: form.required_content_types.includes(ct) ? form.required_content_types.filter(c => c !== ct) : [...form.required_content_types, ct] });
  };

  const handleSave = async () => {
    if (!form.title || form.title.length < 3) { setMessage('Title must be at least 3 characters'); return; }
    if (!form.description || form.description.length < 20) { setMessage('Description must be at least 20 characters'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/briefs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ...form, deadline: form.deadline || null }),
      });
      if (res.ok) { setMessage('Brief created!'); setForm({ title: '', description: '', campaign_goals: '', target_audience: '', budget_range: '', required_niches: [], required_platforms: [], required_content_types: [], deadline: '' }); onSaved(); }
      else { const d = await res.json(); setMessage(d.error || 'Failed'); }
    } catch (err: any) { setMessage(err.message); }
    finally { setSaving(false); setTimeout(() => setMessage(''), 3000); }
  };

  const groupedProfessions = CATEGORIES.map(cat => ({
    category: cat,
    professions: PROFESSIONS.filter(p => p.category === cat),
  }));

  return (
    <div style={{ color: C.text, fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif" }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Create a Brief</h2>
      <p style={{ fontSize: '13px', color: C.textMuted, marginBottom: '16px' }}>Describe what you're looking for. We'll match you with relevant creators.</p>

      {message && <div style={{ padding: '8px 12px', background: `${withAlpha(C.success, 0x20)}`, borderRadius: '6px', fontSize: '12px', color: C.success, marginBottom: '12px' }}>{message}</div>}

      <div style={{ display: 'grid', gap: '12px' }}>
        <input placeholder="Brief title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          style={{ padding: '10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, fontSize: '14px' }} />

        <textarea placeholder="Describe your campaign, goals, and what you need from creators *" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          style={{ padding: '10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, fontSize: '14px', minHeight: '80px' }} />

        <textarea placeholder="Campaign goals (e.g., increase brand awareness, drive sales)" value={form.campaign_goals} onChange={e => setForm({ ...form, campaign_goals: e.target.value })}
          style={{ padding: '10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, fontSize: '14px', minHeight: '60px' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <input placeholder="Target audience (e.g., women 18-35, gamers)" value={form.target_audience} onChange={e => setForm({ ...form, target_audience: e.target.value })}
            style={{ padding: '10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, fontSize: '14px' }} />
          <input placeholder="Budget range (e.g., 1000-5000)" value={form.budget_range} onChange={e => setForm({ ...form, budget_range: e.target.value })}
            style={{ padding: '10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, fontSize: '14px' }} />
        </div>

        <div>
          <label style={{ fontSize: '12px', color: C.textMuted, marginBottom: '8px', display: 'block' }}>
            Creator Niches <span style={{ color: '#555' }}>({form.required_niches.length} selected)</span>
          </label>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {form.required_niches.map(n => <span key={n} style={{ padding: '4px 8px', background: `${withAlpha(C.primary, 0x20)}`, borderRadius: '4px', fontSize: '12px', color: C.primary }}>{n} <span onClick={() => toggleNiche(n)} style={{ cursor: 'pointer', marginLeft: '4px' }}>x</span></span>)}
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                style={{
                  padding: '5px 10px', borderRadius: '5px', border: `1px solid ${selectedCategory === cat ? C.primary : C.border}`,
                  background: selectedCategory === cat ? `${withAlpha(C.primary, 0x20)}` : 'transparent',
                  color: selectedCategory === cat ? C.primary : C.textMuted, cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                  textTransform: 'uppercase',
                }}>
                {cat}
              </button>
            ))}
          </div>

          <div style={{
            maxHeight: '200px', overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '6px',
            background: C.bg,
          }}>
            {groupedProfessions.map(group => (
              <div key={group.category} style={{ display: selectedCategory && selectedCategory !== group.category ? 'none' : 'block' }}>
                {!selectedCategory && (
                  <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, padding: '6px 4px 2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {group.category}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', padding: '2px 0 6px' }}>
                  {group.professions.map(p => {
                    const isSelected = form.required_niches.includes(p.name);
                    const count = professionCounts.get(p.name);
                    return (
                      <button key={p.id} onClick={() => toggleNiche(p.name)}
                        style={{
                          padding: '5px 8px', borderRadius: '5px',
                          border: `1px solid ${isSelected ? C.primary : C.border}`,
                          background: isSelected ? `${withAlpha(C.primary, 0x20)}` : 'transparent',
                          color: isSelected ? C.primary : C.text,
                          cursor: 'pointer', fontSize: '11px',
                          display: 'flex', alignItems: 'center', gap: '4px',
                          opacity: loadingCounts ? 0.7 : 1,
                        }}>
                        <span>{p.name}</span>
                        {count !== undefined && (
                          <span style={{
                            fontSize: '10px', color: isSelected ? C.primary : '#555',
                            background: 'rgba(255,255,255,0.05)', padding: '1px 5px',
                            borderRadius: '8px',
                          }}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {loadingCounts && (
              <div style={{ fontSize: '11px', color: C.textMuted, padding: '8px', textAlign: 'center' }}>
                Loading creator counts...
              </div>
            )}
          </div>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: C.textMuted, marginBottom: '6px', display: 'block' }}>Required Platforms</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {PLATFORMS.map(p => (
              <button key={p.id} onClick={() => togglePlatform(p.id)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: `1px solid ${form.required_platforms.includes(p.id) ? C.primary : C.border}`, background: form.required_platforms.includes(p.id) ? `${withAlpha(C.primary, 0x20)}` : 'transparent', color: form.required_platforms.includes(p.id) ? C.primary : C.textMuted, cursor: 'pointer', fontSize: '13px' }}>{p.label}</button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: C.textMuted, marginBottom: '6px', display: 'block' }}>Content Types</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {CONTENT_TYPES.map(ct => (
              <button key={ct} onClick={() => toggleContent(ct)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: `1px solid ${form.required_content_types.includes(ct) ? C.primary : C.border}`, background: form.required_content_types.includes(ct) ? `${withAlpha(C.primary, 0x20)}` : 'transparent', color: form.required_content_types.includes(ct) ? C.primary : C.textMuted, cursor: 'pointer', fontSize: '13px', textTransform: 'capitalize' }}>{ct}</button>
            ))}
          </div>
        </div>

        <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
          style={{ padding: '10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, fontSize: '14px' }} />

        <button onClick={handleSave} disabled={saving}
          style={{ padding: '10px', background: C.primary, color: '#000', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1, fontSize: '14px' }}>
          {saving ? 'Saving...' : 'Create Brief'}
        </button>
      </div>
    </div>
  );
}
