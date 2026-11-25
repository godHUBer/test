import {createHmac,timingSafeEqual} from 'node:crypto';
export function hash(secret:string,value:string){return createHmac('sha256',secret).update(value).digest('hex');}
export function signForm(secret:string,key:string,issued:number){return hash(secret,`intake:${key}:${issued}`);}
export function validForm(secret:string,key:string,issued:string,signature:string,now=Date.now()){
 if(!/^\d{13}$/.test(issued)||!/^[a-f0-9]{64}$/.test(signature))return false;
 const age=now-Number(issued);if(age<2000||age>7200000)return false;
 return timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(signForm(secret,key,+issued),'hex'));
}
