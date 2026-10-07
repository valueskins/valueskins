// The profile, in full: the Instagram username, linking to Instagram.
import { C } from '@/theme/colors';

// Instagram handles are letters, digits, dots and underscores. Anything else is
// not interpolated into a URL.
const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

export default function InstagramUsername({ handle }: { handle: string }) {
  const clean = handle.replace(/^@/, '');
  const style: React.CSSProperties = {
    color: C.text,
    fontSize: 20,
    fontWeight: 700,
    textDecoration: 'none',
  };
  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      {HANDLE_RE.test(clean) ? (
        <a
          href={`https://www.instagram.com/${clean}/`}
          target="_blank"
          rel="noopener noreferrer"
          style={style}
        >
          @{clean}
        </a>
      ) : (
        <span style={style}>@{clean}</span>
      )}
    </div>
  );
}
