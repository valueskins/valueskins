// The profile, in full: the Instagram username, linking to Instagram.
import { C } from '@/theme/colors';
import { isInstagramHandle, handleLabel, instagramUrl } from '@/lib/handle';

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
      {isInstagramHandle(clean) ? (
        <a href={instagramUrl(clean)} target="_blank" rel="noopener noreferrer" style={style}>
          {handleLabel(clean)}
        </a>
      ) : (
        // No link: we do not know the username, so there is nothing to link to.
        <span style={{ ...style, fontSize: 14, fontWeight: 500, color: C.outline }}>
          {handleLabel(clean)}
        </span>
      )}
    </div>
  );
}
