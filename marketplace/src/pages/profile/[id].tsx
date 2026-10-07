import type { GetServerSidePropsContext } from 'next';
import Head from 'next/head';
import InstagramUsername from '@/components/InstagramUsername';

// Another user's profile: the Instagram username and nothing else. Signed-in
// users only, so the list of accounts cannot be walked anonymously.
export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const { getSessionUserId } = await import('@/lib/session');
  const { queryOne } = await import('@/lib/db');
  const viewerId = await getSessionUserId(ctx.req.headers.cookie || '');
  if (!viewerId) {
    return { redirect: { destination: '/auth/login', permanent: false } };
  }

  const id = typeof ctx.params?.id === 'string' ? ctx.params.id : '';
  // users.id is a BIGSERIAL; anything else is looked up as a username.
  const row = /^[0-9]{1,18}$/.test(id)
    ? await queryOne(
        `SELECT username, instagram_handle FROM users
          WHERE id = $1 AND is_active = TRUE AND is_deleted = FALSE`,
        [id]
      )
    : /^[A-Za-z0-9._-]{1,64}$/.test(id)
      ? await queryOne(
          `SELECT username, instagram_handle FROM users
            WHERE username = $1 AND is_active = TRUE AND is_deleted = FALSE`,
          [id]
        )
      : null;

  const u = row as any;
  if (!u) return { notFound: true };
  return { props: { handle: String(u.instagram_handle || u.username || '') } };
}

export default function ProfilePage({ handle }: { handle: string }) {
  return (
    <>
      <Head><title>{`@${handle} · ValueSkins`}</title></Head>
      <InstagramUsername handle={handle} />
    </>
  );
}
