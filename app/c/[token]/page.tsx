import { redirect } from 'next/navigation';
// Links sent before the address change still work.
export default async function Old(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  redirect(`/secure/${encodeURIComponent(token)}`);
}
