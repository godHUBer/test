'use client';
import { useEffect, useState } from 'react';
import { StaffGate } from '@/components/admin/staff-gate';
import { AdminFrame } from '@/components/admin/frame';
import { SettingsForm } from '@/components/business/admin-forms';
import { useSupabaseClient } from '@/lib/auth/client-session';

interface BrandSettings { version: number; name: string; tagline: string; phone_display: string; phone_href: string; email: string; address_short: string; address_city: string; area: string; map_url: string; hours: string | null; services: string[] }

function SettingsContent() {
  const client = useSupabaseClient();
  const [settings, setSettings] = useState<BrandSettings | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!client) return;
    client.from('brand_settings').select('version,name,tagline,phone_display,phone_href,email,address_short,address_city,area,map_url,hours,services').eq('id', 1).maybeSingle<BrandSettings>().then((res) => {
      if (!active) return;
      if (res.error || !res.data) setError(true); else setSettings(res.data);
    });
    return () => { active = false; };
  }, [client]);

  return (
    <AdminFrame title="Business settings">
      {error || !settings ? <p role="alert">Could not load the existing singleton. No new settings record is fabricated.</p> : <SettingsForm settings={settings as unknown as Record<string, unknown>} />}
    </AdminFrame>
  );
}

export default function SettingsPage() {
  return (
    <StaffGate title="Business settings" blocked={() => <AdminFrame title="Business workflows setup pending"><p>Settings are not activated.</p></AdminFrame>}>
      {(session) => session.profile!.role === 'staff'
        ? <AdminFrame title="Business settings"><p>Manager/owner with MFA required.</p></AdminFrame>
        : <SettingsContent />}
    </StaffGate>
  );
}
