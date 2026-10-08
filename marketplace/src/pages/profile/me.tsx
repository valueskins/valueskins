import type { GetServerSidePropsContext } from 'next';

// The profile is a section of Settings now; this keeps old links working.
export async function getServerSideProps(_ctx: GetServerSidePropsContext) {
  return { redirect: { destination: '/settings', permanent: false } };
}

export default function ProfileMeRedirect() {
  return null;
}
