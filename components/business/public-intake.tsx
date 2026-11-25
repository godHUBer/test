import {randomUUID} from 'node:crypto';
import {intakeConfig} from '@/lib/business/config';
import {signForm} from '@/lib/business/token';
import type {IntakeKind} from '@/lib/business/validation';
import {IntakeForm} from './intake-form';
export async function PublicIntake({kind,source,vehicleId,cars,services}:{kind:IntakeKind;source:string;vehicleId?:string;cars?:{id:string;label:string}[];services?:{id:string;name:string}[]}){
 const config=intakeConfig();if(!config)return null;
 // Per-request security envelope on this force-dynamic server render; never cached across visitors.
 // eslint-disable-next-line react-hooks/purity
 const requestKey=randomUUID(),issued=Date.now();
 return <IntakeForm requestKey={requestKey} issued={String(issued)} signature={signForm(config.secret,requestKey,issued)} kind={kind} source={source} vehicleId={vehicleId} cars={cars} services={services}/>;
}
