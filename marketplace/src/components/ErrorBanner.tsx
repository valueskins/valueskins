import { C } from '@/theme/colors';

interface Props {
  message: string;
  onDismiss?: () => void;
  style?: React.CSSProperties;
}

export default function ErrorBanner({ message, onDismiss, style }: Props) {
  if (!message) return null;
  return (
    <div style={{
      padding: '10px 14px',
      background: 'var(--c-error-container)',
      color: C.error,
      borderRadius: '8px',
      fontSize: '13px',
      border: '1px solid var(--c-error)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '8px',
      ...style,
    }}>
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.error, fontSize: '16px', padding: '0 4px', flexShrink: 0,
          }}
        >
          
        </button>
      )}
    </div>
  );
}
