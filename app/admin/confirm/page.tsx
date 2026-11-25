import { AuthFrame } from '@/components/auth/auth-frame';
import { authConfig } from '@/lib/supabase/config';
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const token = typeof query.token_hash === 'string' ? query.token_hash : '';
  const type = typeof query.type === 'string' ? query.type : '';
  const valid = /^[a-f0-9]{20,256}$/i.test(token) && ['invite','recovery'].includes(type);
  return <AuthFrame title="Confirm staff access link">
    {!authConfig() ? <p>Staff authentication is not configured in this preview.</p> : !valid ? <p>This link is invalid. Request a new invitation or password reset.</p> : <>
      <p>Continue only if you requested this password reset or expected an invitation from the dealership. This confirmation prevents automated email scanners from consuming your link.</p>
      <form method="post" action="/auth/confirm">
        <input type="hidden" name="token_hash" value={token} /><input type="hidden" name="type" value={type} />
        <button className="btn btn--solid" type="submit">Confirm and set password</button>
      </form>
    </>}
  </AuthFrame>;
}
