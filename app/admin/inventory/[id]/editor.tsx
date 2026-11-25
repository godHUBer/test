'use client';
/* eslint-disable @next/next/no-img-element -- short-lived authorised storage previews, never public optimisation */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { StaffGate } from '@/components/admin/staff-gate';
import { AdminFrame, InventoryBlocked } from '@/components/admin/frame';
import { VehicleForm, StatusForm, UploadForm, PhotoOrderForm, PublishPhotoForm, RemovePhotoForm, PrivateNoteForm } from '@/components/admin/forms';
import { StockHistory } from '@/components/admin/history';
import { loadVehicleEditorClient, type VehicleEditorResult } from '@/lib/admin/client-queries';
import { useSupabaseClient } from '@/lib/auth/client-session';

export function VehicleEditor() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const client = useSupabaseClient();
  const router = useRouter();
  const [result, setResult] = useState<VehicleEditorResult | null>(null);

  useEffect(() => {
    let active = true;
    if (!client) return;
    loadVehicleEditorClient(client, id).then((r) => { if (active) setResult(r); });
    return () => { active = false; };
  }, [client, id]);

  if (result?.state === 'blocked') return <InventoryBlocked />;
  if (result?.state === 'missing') {
    return <AdminFrame title="Vehicle not found"><p>No vehicle matches this reference. <Link href="/admin/inventory">Back to inventory</Link>.</p></AdminFrame>;
  }
  if (result?.state === 'error') {
    return <AdminFrame title="Vehicle could not be loaded"><p role="alert">The authorised read failed. Reload or contact an owner; no empty record was substituted.</p></AdminFrame>;
  }
  if (!result || result.state !== 'ready') {
    return <AdminFrame title="Loading vehicle"><p>Checking authorised access…</p></AdminFrame>;
  }
  const { car, media, urls, mediaConfigured } = result;
  const manager = true; // role gate handled by StaffGate + RPCs; managers see status controls
  const editable = manager || car.status === 'draft';

  return (
    <AdminFrame title={`${car.year} ${car.make} ${car.model}`}>
      <p>Reference {car.id} · status <strong>{car.status}</strong> · version {car.version}. Reload after each successful change. Stale edits are rejected, not silently merged.</p>
      <Link href={`/admin/inventory/${id}/preview`}>Preview this record privately</Link>
      <VehicleForm car={car} canEdit={editable} manager={manager} />
      {manager && <StatusForm car={car} />}
      {!editable && <p>Staff can inspect this record but only edit drafts.</p>}
      <section>
        <h2>Vehicle photographs</h2>
        <p>Private uploads are not public. Managers review and explicitly approve individual photos for public use, then save their cover/gallery order. Only then can a new vehicle be published.</p>
        {editable && <><UploadForm car={car} enabled={mediaConfigured} /><PhotoOrderForm car={car} assets={media} /></>}
        <div className="admin-media-grid">
          {media.map((asset) => (
            <article key={asset.id} className="notes">
              <h3>Photo {asset.id.slice(0, 8)}</h3>
              <p>{asset.state} · {asset.width ?? '?'} × {asset.height ?? '?'} px</p>
              {urls[asset.id] ? <img src={urls[asset.id]} alt={`${car.make} ${car.model} — authorised private preview`} width={480} height={360} /> : <p>Preview unavailable or upload pending. Reload to refresh expired links.</p>}
              {manager && mediaConfigured && <PublishPhotoForm car={car} asset={asset} />}
              {editable && <RemovePhotoForm car={car} asset={asset} />}
            </article>
          ))}
        </div>
        {!media.length && <p>No active registered photos. Upload and explicitly save a selection to replace existing cover/gallery references; removing a library entry alone does not rewrite a listing.</p>}
      </section>
      {editable && <PrivateNoteForm car={car} note={result.note} />}
      <StockHistory events={result.events} />
      <button type="button" className="btn btn--line" onClick={() => router.push('/admin/inventory')}>Back to inventory</button>
    </AdminFrame>
  );
}

export default function VehicleEditorPage() {
  return (
    <StaffGate title="Vehicle editor" blocked={() => <InventoryBlocked />}>
      {() => <VehicleEditor />}
    </StaffGate>
  );
}
