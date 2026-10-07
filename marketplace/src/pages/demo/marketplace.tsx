import type { GetServerSidePropsContext } from 'next';

// This route used to render the legacy shell, which kept deals, campaigns and
// applications in localStorage and carried the store and the levelling system.
// The deal workflow now lives on server-backed pages and settings on /settings,
// so the route only forwards old links.
export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const destination = ctx.query.view === 'settings' ? '/settings' : '/deals/browse';
  return { redirect: { destination, permanent: false } };
}

export default function LegacyMarketplaceRedirect() {
  return null;
}
