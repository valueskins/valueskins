// An applicant's track record, expanded inline.
//
// The resume endpoint already returned all of this — last 10 completed deals,
// engagement rate, bio, follower count — and nothing called it. A brand was
// choosing between applicants on a follower number alone, which is exactly the
// guesswork the resume exists to replace.
//
// Expanded on click rather than hover: this is a decision about who gets paid,
// not a tooltip, and hover cards are unusable on touch.
import { useEffect, useState } from 'react';
import { C, withAlpha } from '@/theme/colors';
import { getVirtualResume, isOk } from '@/lib/deal-api';
import { isInstagramHandle, handleLabel, instagramUrl } from '@/lib/handle';

interface Resume {
  username: string;
  email: string | null;
  pitch?: string;
  display_name: string;
  role: string;
  instagram: {
    handle: string;
    bio: string;
    profile_pic_url: string;
    followers: number;
    engagement_rate: number;
  };
  stats: { completed_deals: number; total_value: number; member_since: string };
  recent_deals: Array<{
    id: string;
    title: string;
    amount: string;
    updated_at: string;
    counterpart_username: string | null;
  }>;
}

export default function CreatorResume({ username }: { username: string }) {
  const [resume, setResume] = useState<Resume | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getVirtualResume(username);
      if (cancelled) return;
      if (!isOk(res)) setError(res.error);
      else setResume(res.data as Resume);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [username]);

  const box: React.CSSProperties = {
    background: C.surfaceAlt,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    textAlign: 'left',
  };

  if (loading) return <div style={{ ...box, fontSize: 11, color: C.outline }}>Loading history…</div>;
  if (error || !resume) {
    return (
      <div style={{ ...box, fontSize: 11, color: C.outline }}>
        Could not load this creator&apos;s history.
      </div>
    );
  }

  const { instagram: ig, stats, recent_deals: deals } = resume;

  const handle = (ig.handle || resume.username).replace(/^@/, '');
  const linkable = isInstagramHandle(handle);

  return (
    <div style={box}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
        {linkable ? (
          <a
            href={instagramUrl(handle)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: C.text, textDecoration: 'none' }}
          >
            {handleLabel(handle)}
          </a>
        ) : (
          <span style={{ color: C.outline, fontWeight: 500 }}>{handleLabel(handle)}</span>
        )}
      </div>

      {/* Present only for someone who shares a deal with this user. */}
      {resume.email && (
        <div style={{ fontSize: 11, marginBottom: 10 }}>
          <span style={{ color: C.outline }}>Contact: </span>
          <a href={`mailto:${resume.email}`} style={{ color: C.text }}>{resume.email}</a>
        </div>
      )}

      {resume.pitch && (
        <div style={{ fontSize: 11, color: C.text, lineHeight: 1.5, marginBottom: 10, whiteSpace: 'pre-wrap' }}>
          {resume.pitch}
        </div>
      )}

      {ig.bio && (
        <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5, marginBottom: 10 }}>
          {ig.bio}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
        {[
          ['Followers', ig.followers.toLocaleString('en-IN')],
          // Zero here means Meta has not approved the analytics scope rather
          // than that the creator has no engagement, so it is not shown as 0%.
          ['Engagement', ig.engagement_rate ? `${ig.engagement_rate}%` : '—'],
          ['Completed', String(stats.completed_deals)],
          ['Earned', stats.total_value ? `₹${Math.round(stats.total_value).toLocaleString('en-IN')}` : '—'],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 9, color: C.outline, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{k}</div>
            <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 9, color: C.outline, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
        Recent completed deals
      </div>
      {deals.length === 0 ? (
        <div style={{ fontSize: 11, color: C.outline }}>
          No completed deals yet — this would be their first.
        </div>
      ) : (
        deals.slice(0, 10).map((d) => (
          <div
            key={d.id}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, padding: '3px 0' }}
          >
            <span style={{ color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {d.title}
              {isInstagramHandle(d.counterpart_username) ? ` · @${d.counterpart_username}` : ''}
            </span>
            <span style={{ color: C.text, whiteSpace: 'nowrap' }}>
              ₹{Number(d.amount || 0).toLocaleString('en-IN')}
            </span>
          </div>
        ))
      )}

      <div
        style={{
          marginTop: 8, fontSize: 9, color: C.outline,
          borderTop: `1px solid ${C.border}`, paddingTop: 6,
        }}
      >
        On ValueSkins since{' '}
        {new Date(stats.member_since).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
      </div>
    </div>
  );
}
