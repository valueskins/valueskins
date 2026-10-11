'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const C = {
  bg: '#0A0A0A',
  surface: 'rgba(10, 10, 10, 0.86)',
  card: 'rgba(20, 20, 20, 0.8)',
  border: 'rgba(184, 180, 172, 0.18)',
  text: '#F5F5F0',
  textSecondary: '#B8B4AC',
  primary: '#C8B89A',
};

export default function AdminDeals() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<any[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    let filtered = deals;

    if (searchTerm) {
      filtered = filtered.filter(deal =>
        deal.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.id?.toString().includes(searchTerm)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(deal => deal.phase === filterStatus);
    }

    setFilteredDeals(filtered);
  }, [searchTerm, filterStatus, deals]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
        credentials: 'include',
      });

      if (!res.ok) {
        router.push('/admin/login');
        return;
      }

      setAuthenticated(true);
      loadDeals();
    } catch (err) {
      router.push('/admin/login');
    } finally {
      setLoading(false);
    }
  };

  const loadDeals = async () => {
    try {
      const res = await fetch('/api/admin/deals', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setDeals(data.deals || []);
      } else {
        setError('Failed to load deals');
      }
    } catch (err) {
      setError('Error loading deals');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'var(--c-accent)';
      case 'in_progress':
        return 'var(--c-accent)';
      case 'pending':
        return 'var(--c-warning)';
      case 'disputed':
        return 'var(--c-error)';
      default:
        return C.textSecondary;
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: C.textSecondary }}>Loading...</p>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/admin/main" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginRight: '20px' }}>← Back</Link>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: C.text, margin: 0, flex: 1 }}>All Deals</h1>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        {error && (
          <div style={{
            padding: '16px',
            background: 'var(--c-error-container)',
            color: 'var(--c-error)',
            borderRadius: '8px',
            marginBottom: '20px',
            border: `1px solid var(--c-error)`
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <input
            type="text"
            placeholder="Search deals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '12px',
              border: `1px solid ${C.border}`,
              borderRadius: '8px',
              fontSize: '14px',
              background: C.surface,
              color: C.text,
              boxSizing: 'border-box'
            }}
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '12px',
              border: `1px solid ${C.border}`,
              borderRadius: '8px',
              fontSize: '14px',
              background: C.surface,
              color: C.text,
              boxSizing: 'border-box'
            }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="disputed">Disputed</option>
          </select>
        </div>

        <div style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '20px' }}>
          Found {filteredDeals.length} deals
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '12px', textAlign: 'left', color: C.text, fontWeight: 600, fontSize: '14px' }}>Deal ID</th>
                <th style={{ padding: '12px', textAlign: 'left', color: C.text, fontWeight: 600, fontSize: '14px' }}>Title</th>
                <th style={{ padding: '12px', textAlign: 'left', color: C.text, fontWeight: 600, fontSize: '14px' }}>Amount</th>
                <th style={{ padding: '12px', textAlign: 'left', color: C.text, fontWeight: 600, fontSize: '14px' }}>Created</th>
                <th style={{ padding: '12px', textAlign: 'left', color: C.text, fontWeight: 600, fontSize: '14px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map((deal, idx) => (
                <tr key={idx} style={{ borderBottom: `1px solid ${C.border}`, background: idx % 2 === 0 ? C.surface : 'transparent' }}>
                  <td style={{ padding: '12px', color: C.text, fontSize: '14px' }}>{deal.id}</td>
                  <td style={{ padding: '12px', color: C.text, fontSize: '14px' }}>{deal.title || 'Untitled'}</td>
                  <td style={{ padding: '12px', color: C.text, fontSize: '14px' }}>₹{deal.amount || 0}</td>
                  <td style={{ padding: '12px', color: C.textSecondary, fontSize: '14px' }}>{new Date(deal.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '12px', fontSize: '14px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: `${getStatusColor(deal.phase)}20`,
                      color: getStatusColor(deal.phase),
                      fontSize: '12px',
                      fontWeight: 600,
                      textTransform: 'capitalize'
                    }}>
                      {deal.phase || 'unknown'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredDeals.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: C.textSecondary }}>
            No deals found
          </div>
        )}
      </div>
    </div>
  );
}
