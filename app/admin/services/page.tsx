'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StaffGate } from '@/components/admin/staff-gate';
import { AdminFrame } from '@/components/admin/frame';
import { ServiceForm } from '@/components/business/admin-forms';
import { useSupabaseClient } from '@/lib/auth/client-session';
import type { Service } from '@/lib/business/types';

function ServiceAdmin() {
  const client = useSupabaseClient();
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!client) return;
    client.from('service_catalogue').select('id,name,description,active,sort_order,version').order('sort_order').limit(100).returns<Service[]>().then((res) => {
      if (!active) return;
      if (res.error) setError(true); else setServices(res.data ?? []);
    });
    return () => { active = false; };
  }, [client]);

  return (
    <AdminFrame title="Service catalogue">
      <p>Publish only confirmed offerings. Deactivate instead of deleting historical services. <Link href="/admin/services">Reload catalogue</Link> after saves.</p>
      {error ? <p role="alert">Could not load services.</p> : !services ? <p>Loading services…</p> : (
        <>
          {services.map((service) => <ServiceForm key={service.id} service={service} newId={service.id} />)}
          <ServiceForm newId={crypto.randomUUID()} />
        </>
      )}
    </AdminFrame>
  );
}

export default function ServiceAdminPage() {
  return (
    <StaffGate title="Service catalogue" blocked={() => <AdminFrame title="Business workflows setup pending"><p>Service management is not activated.</p></AdminFrame>}>
      {(session) => session.profile!.role === 'staff'
        ? <AdminFrame title="Service catalogue"><p>Only managers/owners with MFA edit the service catalogue.</p></AdminFrame>
        : <ServiceAdmin />}
    </StaffGate>
  );
}
