import 'server-only';
import {requireStaff} from '@/lib/auth/session';
export async function inventorySession(){
  const session=await requireStaff();if(!session)return null;
  const result=await session.client.rpc('inventory_workflow_version');
  return !result.error&&result.data===4?session:null;
}
