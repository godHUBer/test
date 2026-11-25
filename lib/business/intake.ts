'use server';
import {headers} from 'next/headers';
import {validUuid} from '@/lib/auth/policy';
import {isIP} from 'node:net';
import {intakeConfig,intakeClient} from './config';
import {parseIntake,uuid,value,type BusinessState} from './validation';
import {hash,validForm} from './token';
export async function submitIntake(_state:BusinessState,form:FormData):Promise<BusinessState>{
 const config=intakeConfig();if(!config)return{error:'Online intake is not configured. No request was stored. Please call or email the showroom.'};
 try{
  const key=uuid(form,'request_key'),issued=value(form,'issued',13),signature=value(form,'signature',64);
  if(!validForm(config.secret,key,issued,signature))return{error:'Please wait a moment before submitting, or reload if the form is over two hours old.'};
  const payload=parseIntake(form),client=intakeClient(config);
  const contract=await client.rpc('business_workflow_version');if(contract.error||contract.data!==5)return{error:'Online intake is unavailable. No stored reference was confirmed; please call the showroom.'};
  let network:string|null=null;const header=process.env.INTAKE_TRUSTED_IP_HEADER;
  if(header){if(!['cf-connecting-ip','x-real-ip'].includes(header))return{error:'Intake network configuration needs attention. Please contact the showroom.'};const ip=(await headers()).get(header);if(!ip||!isIP(ip))return{error:'Could not verify the request network. Please contact the showroom.'};network=hash(config.secret,'network:'+ip);}
  const result=await client.rpc('accept_business_request',{request_key:key,fingerprint:hash(config.secret,JSON.stringify(payload)),payload,contact_hash:hash(config.secret,'phone:'+payload.phone.replace(/^\+/,'')),network_hash:network});
  if(result.error||typeof result.data!=='string'||!validUuid(result.data))return{error:result.error?.code==='P0001'?'Too many recent requests. Wait before retrying or call the showroom.':'Submission was not confirmed. Keep this form and retry unchanged, or contact the showroom. Availability may have changed. No booking or notification is confirmed.'};
  return{reference:result.data,message:'Your request was stored for the dealership to review. This is not a confirmed appointment. Automatic email/SMS notifications are not enabled.'};
 }catch(error){return{error:error instanceof Error&&!/fetch|network|timeout/i.test(error.message)?error.message:'Could not confirm storage. Retry this same form to avoid duplicates, or contact the showroom.'};}
}
