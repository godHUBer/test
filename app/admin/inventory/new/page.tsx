import {inventorySession} from '@/lib/admin/session';
import {AdminFrame,InventoryBlocked} from '@/components/admin/frame';
import {VehicleForm} from '@/components/admin/forms';
export default async function NewVehicle(){const session=await inventorySession();if(!session)return <InventoryBlocked/>;return <AdminFrame title="Create inventory draft"><VehicleForm canEdit manager={session.profile.role!=='staff'}/></AdminFrame>;}
