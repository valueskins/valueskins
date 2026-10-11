import { C } from '@/theme/colors';
import Link from 'next/link';

interface Props {
  title?: string;
  message?: string;
  action?: { label: string; href: string };
  icon?: string;
}

export default function EmptyState({ title, message, action, icon }: Props) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '60px 20px',
      color: C.textSecondary,
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>{icon || ''}</div>
      <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: C.text }}>{title || 'Nothing here yet'}</h3>
      <p style={{ margin: '0 0 20px', fontSize: '14px', lineHeight: 1.5 }}>{message || 'No items to display.'}</p>
      {action && (
        <Link
          href={action.href}
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            background: C.primary,
            color: 'var(--c-on-primary)',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
