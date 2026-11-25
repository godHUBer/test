import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {businessSession} from '@/lib/business/session';
import {AdminFrame} from '@/components/admin/frame';
import {ServiceForm} from '@/components/business/admin-forms';
import type {Service} from '@/lib/business/types';
export default async function ServiceAdmin(){const s=await businessSession();if(!s)return <AdminFrame title="Business workflows setup pending"><p>Service management is not activated.</p></AdminFrame>;if(s.profile.role==='staff')return <AdminFrame title="Service catalogue"><p>Only managers/owners with MFA edit the service catalogue.</p></AdminFrame>;const result=await s.client.from('service_catalogue').select('id,name,description,active,sort_order,version').order('sort_order').limit(100).returns<Service[]>();return <AdminFrame title="Service catalogue"><p>Publish only confirmed offerings. Deactivate instead of deleting historical services. <Link href="/admin/services">Reload catalogue</Link> after saves.</p>{result.error?<p role="alert">Could not load services.</p>:<>{result.data.map(service=><ServiceForm key={service.id} service={service} newId={service.id}/>)}<ServiceForm newId={randomUUID()}/></>}</AdminFrame>;}
