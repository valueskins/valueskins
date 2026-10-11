'use client';

interface TabNavProps {
  tabs: Array<{ id: string; label: string; icon?: string }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function TabNav({ tabs, activeTab, onTabChange }: TabNavProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid var(--c-border)',
        marginBottom: '24px',
        background: 'var(--c-surface)',
        borderRadius: '8px 8px 0 0',
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            flex: 1,
            padding: '16px',
            background: activeTab === tab.id ? '#0A0A0A' : '#ffffff',
            color: activeTab === tab.id ? '#ffffff' : 'var(--c-text-variant)',
            border: 'none',
            borderBottom: activeTab === tab.id ? '3px solid var(--c-border)' : 'none',
            fontWeight: activeTab === tab.id ? 600 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== tab.id && e.currentTarget instanceof HTMLElement) {
              e.currentTarget.style.background = '#f9fafb';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== tab.id && e.currentTarget instanceof HTMLElement) {
              e.currentTarget.style.background = '#ffffff';
            }
          }}
        >
          {tab.icon && <span style={{ marginRight: '6px' }}>{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
