import { loadAllVehicleIds } from '@/lib/inventory/server';
import PreviewPage from '../preview-view';

export async function generateStaticParams() {
  const ids = await loadAllVehicleIds();
  return ids.map((id) => ({ id }));
}

export default function PreviewRoute() {
  return <PreviewPage />;
}
