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

export default function AdminUsers() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = users.filter(user =>
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchTerm, users]);

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
      loadUsers();
    } catch (err) {
      router.push('/admin/login');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        setError('Failed to load users');
      }
    } catch (err) {
      setError('Error loading users');
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
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: C.text, margin: 0, flex: 1 }}>Users & Creators</h1>
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

        <div style={{ marginBottom: '24px' }}>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '12px',
              border: `1px solid ${C.border}`,
              borderRadius: '8px',
              fontSize: '14px',
              background: C.surface,
              color: C.text,
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '20px' }}>
          Found {filteredUsers.length} users
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '12px', textAlign: 'left', color: C.text, fontWeight: 600, fontSize: '14px' }}>Email</th>
                <th style={{ padding: '12px', textAlign: 'left', color: C.text, fontWeight: 600, fontSize: '14px' }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left', color: C.text, fontWeight: 600, fontSize: '14px' }}>Joined</th>
                <th style={{ padding: '12px', textAlign: 'left', color: C.text, fontWeight: 600, fontSize: '14px' }}>Deals</th>
                <th style={{ padding: '12px', textAlign: 'left', color: C.text, fontWeight: 600, fontSize: '14px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, idx) => (
                <tr key={idx} style={{ borderBottom: `1px solid ${C.border}`, background: idx % 2 === 0 ? C.surface : 'transparent' }}>
                  <td style={{ padding: '12px', color: C.text, fontSize: '14px' }}>{user.email}</td>
                  <td style={{ padding: '12px', color: C.text, fontSize: '14px' }}>{user.display_name || 'N/A'}</td>
                  <td style={{ padding: '12px', color: C.textSecondary, fontSize: '14px' }}>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '12px', color: C.text, fontSize: '14px' }}>{user.total_deals || 0}</td>
                  <td style={{ padding: '12px', fontSize: '14px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: user.status === 'active' ? 'var(--c-border)' : 'rgba(176, 65, 62, 0.2)',
                      color: user.status === 'active' ? 'var(--c-accent)' : 'var(--c-error)',
                      fontSize: '12px',
                      fontWeight: 600
                    }}>
                      {user.status || 'unknown'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: C.textSecondary }}>
            No users found
          </div>
        )}
      </div>
    </div>
  );
}
