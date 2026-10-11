import React, { useEffect, useState } from 'react';

interface UserReputation {
  userId: number;
  totalReviews: number;
  dealsCompleted: number;
  avgDealRating: number;
  trustScore: number;
  lastUpdatedAt: string;
}

interface ActivityHistoryEntry {
  id: number;
  userId: number;
  activityType: string;
  entityId: number | null;
  entityType: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  activityDate: string;
}

const C = {
  primary: '#0A0A0A',
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f9fafb',
  card: '#f3f4f6',
  text: 'var(--c-text)',
  textSecondary: 'var(--c-text-variant)',
  textMuted: 'var(--c-text-variant)',
  border: 'var(--c-border)',
  success: 'var(--c-accent)',
  warning: 'var(--c-warning)',
  danger: 'var(--c-error)',
  accent: '#A08A5E',
};

interface Props {
  userId: number;
}

const ReputationAndHistoryLight: React.FC<Props> = ({ userId }) => {
  const [reputation, setReputation] = useState<UserReputation | null>(null);
  const [history, setHistory] = useState<ActivityHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<'reputation' | 'history' | null>('reputation');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [repRes, histRes] = await Promise.all([
          fetch(`/api/user/${userId}/reputation`),
          fetch(`/api/user/${userId}/history?page=1&limit=5`),
        ]);

        if (!repRes.ok) throw new Error('Failed to fetch reputation');
        if (!histRes.ok) throw new Error('Failed to fetch history');

        const repData: UserReputation = await repRes.json();
        const histData = await histRes.json();

        setReputation(repData);
        setHistory(histData.activities);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <div style={{ marginBottom: '24px' }}>
        <div style={{ height: '200px', background: C.surfaceAlt, borderRadius: '10px', animation: 'pulse 2s' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        marginBottom: '24px',
        padding: '14px',
        background: 'var(--c-error-container)',
        borderRadius: '10px',
        color: 'var(--c-error)',
        fontSize: '13px',
        border: `1px solid var(--c-error)`,
      }}>
        {error}
      </div>
    );
  }

  const getTrustTier = (score: number) => {
    if (score >= 80) return 'Trusted';
    if (score >= 60) return 'Reliable';
    if (score >= 40) return 'Standard';
    return 'New';
  };

  const formatActivityType = (type: string) => {
    const typeMap: Record<string, string> = {
      deal_completed: '🤝 Deal Completed',
      profile_updated: '✏️ Profile Updated',
      valueskin_added: '🎨 Valueskin Added',
      review_received: '💬 Review Received',
    };
    return typeMap[type] || type;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Reputation Summary */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setExpandedSection(expandedSection === 'reputation' ? null : 'reputation')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px',
            background: C.surfaceAlt,
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 700,
            color: C.text,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🏆</span>
            Reputation & Trust
          </div>
          <span style={{ fontSize: '18px', color: C.textMuted }}>
            {expandedSection === 'reputation' ? '▲' : '▼'}
          </span>
        </button>

        {expandedSection === 'reputation' && reputation && (
          <div style={{ marginTop: '10px', display: 'grid', gap: '10px' }}>
            {/* Trust Score */}
            <div style={{
              padding: '14px',
              background: C.surfaceAlt,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>Trust Score</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>
                  {reputation.trustScore}/100 · {getTrustTier(reputation.trustScore)}
                </div>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: C.primary }}>
                {reputation.trustScore}%
              </div>
            </div>


          </div>
        )}
      </div>

      {/* Activity History */}
      {history.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => setExpandedSection(expandedSection === 'history' ? null : 'history')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px',
              background: C.surfaceAlt,
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 700,
              color: C.text,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📅</span>
              Recent Activity
            </div>
            <span style={{ fontSize: '18px', color: C.textMuted }}>
              {expandedSection === 'history' ? '▲' : '▼'}
            </span>
          </button>

          {expandedSection === 'history' && (
            <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
              {history.map((activity, i) => (
                <div
                  key={activity.id}
                  style={{
                    padding: '12px 14px',
                    background: C.surfaceAlt,
                    borderRadius: '10px',
                    borderBottom: i < history.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '4px' }}>
                    {formatActivityType(activity.activityType)}
                  </div>
                  {activity.description && (
                    <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '4px' }}>
                      {activity.description}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: C.textMuted }}>
                    {formatDate(activity.activityDate)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReputationAndHistoryLight;
