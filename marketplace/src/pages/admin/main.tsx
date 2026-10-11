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
  danger: 'var(--c-error)',
  success: 'var(--c-accent)',
};

export default function AdminDashboard() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

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
      loadStats();
    } catch (err) {
      router.push('/admin/login');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/dashboard', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      setError('Failed to load statistics');
    }
  };

  const handleLogout = () => {
    document.cookie = 'admin_session=; Path=/; Max-Age=0';
    router.push('/admin/login');
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
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: C.text, margin: 0 }}>ValueSkins Admin</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            background: C.danger,
            color: 'var(--c-on-primary)',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>

      {/* Navigation */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '0', display: 'flex', gap: '0' }}>
        <NavLink href="/admin/main" label="Dashboard" />
        <NavLink href="/admin/users" label="Users" />
        <NavLink href="/admin/brands" label="Brands" />
        <NavLink href="/admin/deals" label="Deals" />
        <NavLink href="/admin/disputes" label="Disputes" />
        <NavLink href="/admin/pdfs" label="Deal PDFs" />
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

        <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginBottom: '24px' }}>Dashboard Overview</h2>

        {stats ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <StatCard label="Total Users" value={stats.users?.total || 0} secondary={`+${stats.users?.new_this_week || 0} this week`} />
            <StatCard label="Active Deals" value={stats.deals?.active || 0} secondary={`${stats.deals?.total || 0} total`} />
            <StatCard label="Escrow Locked" value={`₹${stats.escrow?.total_locked || 0}`} secondary={`${stats.escrow?.total || 0} pending`} />
            <StatCard label="Total Paid Out" value={`₹${stats.payments?.total_paid || 0}`} secondary={`${stats.payments?.total || 0} completed`} />
            <StatCard label="Pending Verifications" value={stats.brands?.pending || 0} secondary={`${stats.brands?.total || 0} total brands`} />
          </div>
        ) : (
          <p style={{ color: C.textSecondary }}>Loading statistics...</p>
        )}

        <div style={{ marginTop: '40px', padding: '20px', background: C.card, borderRadius: '8px', border: `1px solid ${C.border}` }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Quick Links</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <QuickLink href="/admin/users" label="View All Users" />
            <QuickLink href="/admin/brands" label="Review Brands" />
            <QuickLink href="/admin/deals" label="Manage Deals" />
            <QuickLink href="/admin/disputes" label="Resolve Disputes" />
            <QuickLink href="/admin/pdfs" label="View Deal PDFs" />
          </div>
        </div>
      </div>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={{
      padding: '16px 20px',
      borderBottom: `2px solid transparent`,
      textDecoration: 'none',
      color: C.textSecondary,
      fontSize: '14px',
      fontWeight: 500,
      transition: 'all 0.2s',
      display: 'block'
    }}>
      {label}
    </Link>
  );
}

function StatCard({ label, value, secondary }: { label: string; value: string | number; secondary?: string }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: '8px',
      padding: '20px'
    }}>
      <p style={{ fontSize: '12px', color: C.textSecondary, margin: '0 0 8px 0', textTransform: 'uppercase', fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: '32px', fontWeight: 800, color: C.primary, margin: '0 0 8px 0' }}>{value}</p>
      {secondary && <p style={{ fontSize: '12px', color: C.textSecondary, margin: 0 }}>{secondary}</p>}
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={{
      padding: '12px 16px',
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: '6px',
      textDecoration: 'none',
      color: C.primary,
      fontSize: '14px',
      fontWeight: 500,
      display: 'block',
      textAlign: 'center',
      transition: 'all 0.2s'
    }}>
      {label}
    </Link>
  );
}
