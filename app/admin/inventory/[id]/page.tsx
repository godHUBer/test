import { loadAllVehicleIds } from '@/lib/inventory/server';
import VehicleEditorPage from './editor';

export async function generateStaticParams() {
  const ids = await loadAllVehicleIds();
  return ids.map((id) => ({ id }));
}

export default function VehicleEditorRoute() {
  return <VehicleEditorPage />;
}
