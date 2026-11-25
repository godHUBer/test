import 'server-only';
import {redirect} from 'next/navigation';
import {hasRecentTotp} from '@/lib/auth/policy';
import {requireStaff} from '@/lib/auth/session';
export async function businessSession(){const session=await requireStaff();if(!session)return null;if(session.profile.role!=='staff'){const claims=await session.client.auth.getClaims();if(claims.error||!hasRecentTotp(claims.data?.claims.amr))redirect('/admin/mfa');}const version=await session.client.rpc('business_workflow_version');return !version.error&&version.data===5?session:null;}
