import React, { useState, useEffect } from 'react';

interface NotificationBellProps {
  userId: string;
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const loadNotifications = async () => {
      const res = await fetch(`/api/notifications/get?userId=${userId}`);
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.notifications?.filter((n: any) => !n.read_at).length || 0);
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const handleMarkRead = async (notificationId: string) => {
    await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId }),
    });

    setNotifications(notifications.map(n =>
      n.id === notificationId ? { ...n, read_at: new Date() } : n
    ));
    setUnreadCount(Math.max(0, unreadCount - 1));
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          fontSize: '20px',
          cursor: 'pointer',
          padding: '8px',
        }}
      >
        B
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '0',
              right: '0',
              background: 'var(--c-error)',
              color: 'var(--c-on-primary)',
              borderRadius: '999px',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            minWidth: '350px',
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: 100,
            marginTop: '8px',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--c-border)', fontWeight: 600 }}>
            Notifications
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '24px 16px', color: 'var(--c-text-variant)', textAlign: 'center', fontSize: '14px' }}>
              No notifications
            </div>
          ) : (
            <div>
              {notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--c-border)',
                    cursor: 'pointer',
                    background: n.read_at ? '#ffffff' : 'rgba(10, 10, 10, 0.05)',
                    fontSize: '14px',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--c-text-variant)' }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--c-text-variant)', marginTop: '4px' }}>
                    {new Date(n.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
