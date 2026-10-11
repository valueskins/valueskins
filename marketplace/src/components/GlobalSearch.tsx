'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const C = {
  bg: '#0A0A0A', surface: '#1A1A1A', surfaceAlt: '#2D2D2D',
  text: '#F5F5F0', textMuted: '#B8B4AC', primary: '#C8B89A',
  border: 'var(--c-border)',
};

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>({ creators: [], deals: [], campaigns: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query || query.length < 2) { setResults({ creators: [], deals: [], campaigns: [] }); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/global?q=${encodeURIComponent(query)}`, { credentials: 'include' });
        if (res.ok) setResults(await res.json());
        setOpen(true);
      } catch {} finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const totalCount = (results.creators?.length || 0) + (results.deals?.length || 0) + (results.campaigns?.length || 0);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input ref={inputRef}
        placeholder="Search creators, deals, campaigns..."
        value={query} onChange={e => setQuery(e.target.value)}
        onFocus={() => { if (results.creators?.length || results.deals?.length || results.campaigns?.length) setOpen(true); }}
        style={{
          width: '200px', padding: '6px 10px', background: C.bg, border: `1px solid ${C.border}`,
          borderRadius: '6px', color: C.text, fontSize: '12px', outline: 'none',
        }} />
      {open && totalCount > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 100, maxHeight: '400px', overflowY: 'auto' }}>
          {loading && <div style={{ padding: '8px 12px', fontSize: '12px', color: C.textMuted }}>Searching...</div>}
          {results.creators?.length > 0 && (
            <div>
              <div style={{ padding: '6px 12px', fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Creators</div>
              {results.creators.map((c: any) => (
                <div key={c.id} onClick={() => { setOpen(false); setQuery(''); router.push(`/profile/${c.id}`); }}
                  style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>{(c.display_name || '?')[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{c.display_name || `Creator #${c.id}`}</div>
                    <div style={{ fontSize: '11px', color: C.textMuted }}>{c.niche?.[0] || (c.followers_count ? `${Number(c.followers_count).toLocaleString()} followers` : '')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {results.deals?.length > 0 && (
            <div>
              <div style={{ padding: '6px 12px', fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Deals</div>
              {results.deals.map((d: any) => (
                <div key={d.id} onClick={() => { setOpen(false); setQuery(''); router.push(`/deals/${d.id}`); }}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, fontSize: '13px' }}>
                  <div style={{ fontWeight: 600 }}>{d.title || `Deal #${d.id}`}</div>
                  <div style={{ fontSize: '11px', color: C.textMuted }}>{d.phase} &middot; ${d.budget || 0}</div>
                </div>
              ))}
            </div>
          )}
          {results.campaigns?.length > 0 && (
            <div>
              <div style={{ padding: '6px 12px', fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Campaigns</div>
              {results.campaigns.map((c: any) => (
                <div key={c.id} onClick={() => { setOpen(false); setQuery(''); router.push(`/campaigns/${c.id}`); }}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px' }}>
                  <div style={{ fontWeight: 600 }}>{c.title}</div>
                  <div style={{ fontSize: '11px', color: C.textMuted }}>{c.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
