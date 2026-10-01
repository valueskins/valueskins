// Keeps each role on its own pages.
//
// Every action was already authorised server-side — a brand hitting the apply
// endpoint got 403 — but the UI was showing the wrong role's screens anyway. A
// brand could open the creator feed and see deals, including its own, each with
// an Apply button that could only ever fail. The permission was right and the
// presentation was a lie, which is worse than either alone: it teaches people
// the product is broken.
//
// Pages state the role they are for, and anyone else is sent to their own home.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export type Role = 'brand' | 'creator';

export const HOME_FOR: Record<Role, string> = {
  brand: '/campaigns',
  creator: '/deals/browse',
};

export interface RoleGuard {
  /** The viewer's role, once known. */
  role: Role | null;
  /** True until the role is resolved. Render nothing meaningful before this. */
  loading: boolean;
  /** True when the viewer belongs here. */
  allowed: boolean;
}

/**
 * Resolves the caller's role and redirects if the page is not for them.
 *
 * Returns `loading` so a page can hold its render rather than flashing content
 * the viewer is about to be navigated away from.
 */
export function useRoleGuard(requiredRole: Role): RoleGuard {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/profile/set-email', { credentials: 'include' });
        if (cancelled) return;
        if (res.status === 401) {
          void router.replace('/auth/login');
          return;
        }
        const data = await res.json().catch(() => null);
        const theirs = data?.role === 'brand' ? 'brand' : data?.role === 'creator' ? 'creator' : null;
        setRole(theirs);
        setLoading(false);
        // replace, not push: a wrong-role visit should not sit in history as a
        // back-button trap.
        if (theirs && theirs !== requiredRole) {
          void router.replace(HOME_FOR[theirs]);
        }
      } catch {
        // A failed role lookup leaves the page loading rather than guessing.
        // Guessing wrong either blocks a legitimate user or shows the wrong UI.
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [requiredRole, router]);

  return { role, loading, allowed: role === requiredRole };
}
