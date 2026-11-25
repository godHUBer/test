'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StaffGate } from '@/components/admin/staff-gate';
import { AdminFrame } from '@/components/admin/frame';
import { RequestForm, NoteForm, ViewingForm, JobForm } from '@/components/business/admin-forms';
import { staffTime } from '@/lib/admin/format';
import { useSupabaseClient } from '@/lib/auth/client-session';
import { validUuid } from '@/lib/auth/policy';
import type { RequestRecord, Viewing, ServiceJob } from '@/lib/business/types';

interface NoteRow { id: number; actor_id: string | null; note: string; at: string }
interface EventRow { id: number; actor_id: string | null; event: string; changes: unknown; at: string }
interface Profile { user_id: string; display_name: string | null; role: string }

function RequestDetail() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const client = useSupabaseClient();
  const [state, setState] = useState<{ r: RequestRecord; notes: NoteRow[]; events: EventRow[]; viewings: Viewing[]; job: ServiceJob | null; profiles: Profile[]; manager: boolean } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!client || !validUuid(id)) return;
    (async () => {
      const r = await client.from('business_requests').select('id,reference,kind,vehicle_id,service_id,contact_name,phone,email,message,seller_details,customer_vehicle,source,consent_version,consented_at,status,assigned_to,follow_up_at,version,created_at,updated_at').eq('id', id).maybeSingle<RequestRecord>();
      if (!active) return;
      if (r.error || !r.data) { setError(true); return; }
      const manager = true;
      const [notes, events, viewings, job, profiles] = await Promise.all([
        client.from('request_notes').select('id,actor_id,note,at').eq('request_id', id).order('at', { ascending: false }).limit(50),
        client.from('business_events').select('id,actor_id,event,changes,at').eq('request_id', id).order('at', { ascending: false }).limit(50),
        client.from('viewing_appointments').select('id,request_id,vehicle_id,assigned_to,starts_at,ends_at,status,version').eq('request_id', id).order('starts_at', { ascending: false }).limit(20).returns<Viewing[]>(),
        client.from('service_jobs').select('id,request_id,service_id,status,starts_at,ends_at,version').eq('request_id', id).maybeSingle<ServiceJob>(),
        client.rpc('business_assignees'),
      ]);
      if (!active) return;
      if (notes.error || events.error || viewings.error || job.error || profiles.error) { setError(true); return; }
      setState({ r: r.data, notes: notes.data as NoteRow[], events: events.data as EventRow[], viewings: viewings.data ?? [], job: job.data ?? null, profiles: (profiles.data ?? []) as Profile[], manager });
    })();
    return () => { active = false; };
  }, [client, id]);

  if (error) return <AdminFrame title="Request details unavailable"><p>Could not load one or more authorised workflow sections. Reload; no mutation form is shown.</p></AdminFrame>;
  if (!state) return <AdminFrame title="Loading request"><p>Checking authorised access…</p></AdminFrame>;
  const { r, notes, events, viewings, job, profiles, manager } = state;

  return (
    <AdminFrame title={`${r.kind} request · ${r.reference.slice(0, 8)}`}>
      <p>Stored reference: {r.reference} · version {r.version}. <a href={`/admin/business/request?id=${id}`}>Reload this record</a> after each successful change.</p>
      <section className="notes">
        <h2>{r.contact_name}</h2>
        <p>Phone: {r.phone} · Email: {r.email || 'Not supplied'}</p>
        <p>{r.message}</p>
        <p>Source: {r.source} · received {staffTime(r.created_at)} · consent {r.consent_version} at {staffTime(r.consented_at)}</p>
        {r.vehicle_id && <p>Stock vehicle: {r.vehicle_id}</p>}
        {r.customer_vehicle && <p>Customer-owned vehicle: {r.customer_vehicle}</p>}
        {Object.keys(r.seller_details).length > 0 && <dl className="spec-table">{Object.entries(r.seller_details).map(([key, v]) => <div key={key}><dt>{key}</dt><dd>{v || 'Not supplied'}</dd></div>)}</dl>}
      </section>
      <RequestForm record={r} manager={manager} profiles={profiles} />
      <NoteForm record={r} />
      <section><h2>Private follow-up notes</h2>{notes.map((n) => <article className="notes" key={n.id}><p>{n.note}</p><small>{staffTime(n.at)} · actor {n.actor_id}</small></article>)}</section>
      {r.vehicle_id && <section><h2>Vehicle viewing</h2>{viewings.map((a) => <ViewingForm key={a.id} record={r} appointment={a} newId={a.id} />)}<ViewingForm record={r} newId={crypto.randomUUID()} /></section>}
      {job && <JobForm record={r} job={job} />}
      <section><h2>Workflow history (latest 50)</h2><ol className="admin-history">{events.map((e) => <li key={e.id}>{staffTime(e.at)} · {e.event} · actor {e.actor_id ?? 'Intake system'}<pre>{JSON.stringify(e.changes, null, 2)}</pre></li>)}</ol></section>
    </AdminFrame>
  );
}

export default function RequestPage() {
  return <StaffGate title="Request details" blocked={() => <AdminFrame title="Business workflows setup pending"><p>No authorised workflow connection is active.</p></AdminFrame>}>
    {() => <Suspense fallback={<AdminFrame title="Loading request"><p>Loading…</p></AdminFrame>}><RequestDetail /></Suspense>}
  </StaffGate>;
}
