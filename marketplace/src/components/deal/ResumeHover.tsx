// Virtual resume on hover (BUILD_PROMPT "VIRTUAL RESUME (HOVER)"): hovering a
// profile name floats that user's resume next to it.
//
// Focus opens it as well, so it is reachable by keyboard, and the resume is
// only fetched the first time it is opened.
import { useRef, useState } from 'react';
import CreatorResume from './CreatorResume';

export default function ResumeHover({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  // A short delay so the pointer can travel from the name onto the card.
  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ cursor: 'default', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
      >
        @{username}
      </span>
      {open && (
        <div
          role="dialog"
          aria-label={`Resume of @${username}`}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 9500,
            width: 300,
            maxWidth: '80vw',
            fontWeight: 400,
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
            borderRadius: 8,
          }}
        >
          <CreatorResume username={username} />
        </div>
      )}
    </span>
  );
}
