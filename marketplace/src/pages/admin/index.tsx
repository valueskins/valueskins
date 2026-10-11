'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const C = {
  primary: '#0A0A0A',
  bg: '#ffffff',
  surface: '#F5F5F0',
  card: '#ffffff',
  text: '#0A0A0A',
  textSecondary: 'var(--c-text-muted)',
  textMuted: '#B8B4AC',
  border: 'var(--c-border)',
  success: 'var(--c-accent)',
  danger: 'var(--c-error)',
};

export default function AdminPanel() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'users'>('dashboard');
  const [error, setError] = useState('');

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify' }),
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setAdminEmail(data.email);
          setAuthenticated(true);
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogout = async () => {
    // Clear admin session cookie
    document.cookie = 'admin_session=; Path=/; Max-Age=0';
    setAuthenticated(false);
    setAdminEmail('');
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ color: C.textSecondary }}>Loading...</p>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginPage onSuccess={(email) => {
      setAdminEmail(email);
      setAuthenticated(true);
    }} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: C.surface }}>
      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: C.text }}>Admin Panel</h1>
          <p style={{ fontSize: '12px', color: C.textSecondary, marginTop: '4px' }}>Logged in as: {adminEmail}</p>
        </div>
        <button onClick={handleLogout} style={{ background: C.danger, color: 'var(--c-on-primary)', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '0 20px', display: 'flex', gap: '20px' }}>
        {(['dashboard', 'reports', 'users'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '16px 0',
              border: 'none',
              background: 'none',
              color: activeTab === tab ? C.primary : C.textSecondary,
              borderBottom: activeTab === tab ? `2px solid ${C.primary}` : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 600 : 400,
              fontSize: '14px',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '20px' }}>
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'users' && <UsersTab adminEmail={adminEmail} />}
      </div>
    </div>
  );
}

function LoginPage({ onSuccess }: { onSuccess: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleToken, setGoogleToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password, googleToken }),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Login failed');
        return;
      }

      const data = await response.json();
      onSuccess(data.email);
    } catch (err) {
      setError('Login error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.surface }}>
      <div style={{ background: C.card, padding: '40px', borderRadius: '12px', maxWidth: '400px', width: '90%', border: `1px solid ${C.border}` }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Admin Login</h1>
        <p style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '24px' }}>Secure access required</p>

        {error && (
          <div style={{ background: '#ffebee', border: '1px solid #ffcdd2', color: C.danger, padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: C.textMuted, marginBottom: '6px' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@valueskins.com"
              required
              style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: C.textMuted, marginBottom: '6px' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: C.textMuted, marginBottom: '6px' }}>Google Auth Token</label>
            <input
              type="text"
              value={googleToken}
              onChange={(e) => setGoogleToken(e.target.value)}
              placeholder="Token from Google OAuth"
              required
              style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? C.textMuted : C.primary,
              color: 'var(--c-text)',
              border: 'none',
              padding: '12px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

function DashboardTab() {
  return (
    <div style={{ background: C.card, padding: '20px', borderRadius: '12px', border: `1px solid ${C.border}` }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '16px' }}>Dashboard</h2>
      <p style={{ color: C.textSecondary }}>Admin metrics would load here from /api/admin/dashboard</p>
    </div>
  );
}

function ReportsTab() {
  return (
    <div style={{ background: C.card, padding: '20px', borderRadius: '12px', border: `1px solid ${C.border}` }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '16px' }}>Reports</h2>
      <p style={{ color: C.textSecondary }}>Deal reports synced from localStorage</p>
      <p style={{ color: C.textSecondary, fontSize: '12px', marginTop: '8px' }}>Google Drive integration ready</p>
    </div>
  );
}

function UsersTab({ adminEmail }: { adminEmail: string }) {
  const [suspensions, setSuspensions] = useState<Record<string, any>>({});

  useEffect(() => {
    const saved = localStorage.getItem('vs_admin_suspensions') || '{}';
    setSuspensions(JSON.parse(saved));
  }, []);

  return (
    <div style={{ background: C.card, padding: '20px', borderRadius: '12px', border: `1px solid ${C.border}` }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '16px' }}>User Management</h2>
      <p style={{ color: C.textSecondary }}>Active suspensions:</p>
      <div style={{ marginTop: '12px' }}>
        {Object.keys(suspensions).length === 0 ? (
          <p style={{ color: C.textMuted, fontSize: '14px' }}>No suspended users</p>
        ) : (
          <div style={{ fontSize: '12px' }}>
            {Object.entries(suspensions).map(([userId, data]: [string, any]) => (
              <div key={userId} style={{ padding: '8px', background: C.surface, marginBottom: '8px', borderRadius: '6px' }}>
                <div style={{ color: C.text }}>{userId}</div>
                <div style={{ color: C.textSecondary, fontSize: '11px' }}>Suspended by {data.suspendedBy} at {data.suspendedAt}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
