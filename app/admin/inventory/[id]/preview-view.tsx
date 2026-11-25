'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { StaffGate } from '@/components/admin/staff-gate';
import { AdminFrame, InventoryBlocked } from '@/components/admin/frame';
import { formatPrice, publicImage } from '@/lib/inventory/model';
import { lakhToRupees } from '@/lib/format';
import { loadVehicleEditorClient, type VehicleEditorResult } from '@/lib/admin/client-queries';
import { useSupabaseClient } from '@/lib/auth/client-session';
import { browserAuthConfig } from '@/lib/supabase/config';

export function Preview() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const client = useSupabaseClient();
  const [result, setResult] = useState<VehicleEditorResult | null>(null);

  useEffect(() => {
    let active = true;
    if (!client) return;
    loadVehicleEditorClient(client, id).then((r) => { if (active) setResult(r); });
    return () => { active = false; };
  }, [client, id]);

  if (result?.state === 'blocked') return <InventoryBlocked />;
  if (result?.state === 'missing') return <AdminFrame title="Preview unavailable"><p>No vehicle matches this reference.</p></AdminFrame>;
  if (result?.state === 'error') return <AdminFrame title="Preview unavailable"><p>The authorised read failed.</p></AdminFrame>;
  if (!result || result.state !== 'ready') return <AdminFrame title="Loading preview"><p>Checking authorised access…</p></AdminFrame>;

  const { car, media, urls } = result;
  const legacy = publicImage(car.photo_stock, browserAuthConfig()?.url);
  return (
    <AdminFrame title={`Private preview: ${car.year} ${car.make} ${car.model}`}>
      <p>This is a staff-only preview, not a public listing or an availability claim. Status: {car.status} · version {car.version}. Signed private photo links expire after 60 seconds.</p>
      <Link href={`/admin/inventory/${id}`}>Back to editor</Link>
      <h2>{car.variant}</h2>
      <p>{formatPrice(lakhToRupees(String(car.price_lakh)))}</p>
      <p>{car.overview || 'No overview supplied.'}</p>
      <dl className="spec-table">
        {[['Recorded year', car.year], ['Odometer', car.km], ['Fuel', car.fuel], ['Transmission', car.transmission ?? 'Not stated'], ['Registration region', car.reg], ['Location', car.location]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}
      </dl>
      <div className="admin-media-grid">
        {car.media_order.length ? car.media_order.map((assetId) => {
          const asset = media.find((m) => m.id === assetId);
          return <figure key={assetId}>{urls[assetId] ? <img src={urls[assetId]} alt={`${car.make} ${car.model} selected photograph`} width={900} height={675} /> : <p>Photo preview unavailable for your role.</p>}<figcaption>{asset?.state ?? 'Unavailable asset'}</figcaption></figure>;
        }) : legacy ? <img src={legacy} alt={`${car.make} ${car.model} legacy cover`} width={900} height={675} /> : <p>No selected cover photo.</p>}
      </div>
    </AdminFrame>
  );
}

export default function PreviewPage() {
  return <StaffGate title="Private preview" blocked={() => <InventoryBlocked />}>{() => <Preview />}</StaffGate>;
}
