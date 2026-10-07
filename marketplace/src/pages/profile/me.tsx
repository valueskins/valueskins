import type { GetServerSidePropsContext } from 'next';
import Head from 'next/head';
import InstagramUsername from '@/components/InstagramUsername';

// The profile shows the Instagram username and nothing else.
export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const { getSessionUserId } = await import('@/lib/session');
  const { queryOne } = await import('@/lib/db');
  const userId = await getSessionUserId(ctx.req.headers.cookie || '');
  if (!userId) {
    return { redirect: { destination: '/auth/login', permanent: false } };
  }
  const row = await queryOne(
    'SELECT username, instagram_handle FROM users WHERE id = $1',
    [userId]
  );
  const u = row as any;
  return { props: { handle: String(u?.instagram_handle || u?.username || '') } };
}

export default function ProfileMePage({ handle }: { handle: string }) {
  return (
    <>
      <Head><title>Profile · ValueSkins</title></Head>
      <InstagramUsername handle={handle} />
    </>
  );
}
