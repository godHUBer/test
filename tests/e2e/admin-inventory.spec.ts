import {test,expect,type BrowserContext,type APIRequestContext,type Page} from '@playwright/test';
import sharp from 'sharp';
const app='http://127.0.0.1:3104';
async function login(context:BrowserContext,request:APIRequestContext,role:string,aal='aal2'){
 const response=await request.get(`https://localhost:3444/__session?role=${role}&aal=${aal}`);expect(response.status()).toBe(200);const session=await response.json();
 await context.addCookies([{name:'sb-localhost-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:app,httpOnly:true,sameSite:'Lax'}]);
}
async function createDraft(page:Page,id:string){
 await page.goto(app+'/admin/inventory/new');await expect(page.getByRole('heading',{name:'Create inventory draft'})).toBeVisible();
 for(const [label,value] of [['Permanent URL / vehicle ID',''+id],['Manufacturer','Test Motors'],['Model','Workflow Car'],['Variant','Base'],['Year as recorded','2020'],['Odometer (whole kilometres)','10000'],['Asking price in lakh (exact, up to 5 decimals)','4.25555'],['Fuel','Petrol'],['Body type','SUV'],['Registration region — no full plate required','Test region']])await page.getByLabel(label,{exact:false}).fill(value);
 await page.getByRole('button',{name:'Create draft',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved '+id);await page.getByRole('link',{name:'Reload saved record'}).click();
 await expect(page.getByRole('heading',{name:'2020 Test Motors Workflow Car'})).toBeVisible();
}
async function reloadAfter(page:Page,text:string){const status=page.getByRole('status').filter({hasText:text});await expect(status).toContainText(text);await status.getByRole('link',{name:'Reload saved record'}).click();}
async function transition(page:Page,status:string,reason:string){await page.getByLabel('Next status').selectOption(status);await page.getByLabel('Reason (3–500 characters; no customer contact information)').fill(reason);await page.getByLabel('I reviewed the current status and intend this availability change.').check();await page.getByRole('button',{name:'Apply status change'}).click();await reloadAfter(page,'Status changed to '+status);}
test('staff create/edit drafts; manager performs reviewed photo publication and full stock lifecycle',async({page,context,request})=>{
 await login(context,request,'staff','aal1');await createDraft(page,'browser-car');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.getByRole('button',{name:'Apply status change'})).toHaveCount(0);
 await page.getByLabel('Odometer (whole kilometres)').fill('10001');await page.getByRole('button',{name:'Save specifications'}).click();await reloadAfter(page,'Saved browser-car');
 const image=await sharp({create:{width:800,height:600,channels:3,background:'#447755'}}).jpeg().withMetadata({exif:{IFD0:{Artist:'Private fixture uploader'}}}).toBuffer();
 await page.getByLabel('Still JPEG, PNG or WebP').setInputFiles({name:'private-original-name.jpg',mimeType:'image/jpeg',buffer:image});
 await page.getByRole('button',{name:'Upload privately',exact:true}).click();await reloadAfter(page,'Sanitised photo saved privately');
 await expect(page.locator('.admin-media-grid article')).toHaveCount(1);await expect(page.getByRole('button',{name:'Approve photo for public use'})).toHaveCount(0);
 await login(context,request,'manager');await page.reload();await page.getByLabel(/I reviewed this photograph/).check();await page.getByRole('button',{name:'Approve photo for public use'}).click();await reloadAfter(page,'Photograph is public.');
 await page.locator('.admin-photo-choice input').check();await page.getByRole('button',{name:'Save photo selection'}).click();await reloadAfter(page,'Photo selection saved');
 await transition(page,'available','Reviewed specifications and sanitised cover');
 const publicPage=await context.newPage();await publicPage.goto(app+'/cars/browser-car');await expect(publicPage.locator('main h1')).toHaveText('2020 Test Motors Workflow Car');await expect(publicPage.locator('.kicker').filter({hasText:'Listed as available'})).toBeVisible();
 await transition(page,'reserved','Confirmed hold');await transition(page,'sold','Sale confirmed at showroom');
 await publicPage.reload();await expect(publicPage.getByRole('heading',{name:'This car has been sold.'})).toBeVisible();await expect(publicPage.locator('#enquire')).toHaveCount(0);
 await transition(page,'available','Explicit sale reversal');await transition(page,'archived','Withdrawn for review');await publicPage.reload();expect(await publicPage.title()).toContain('not found');
 await transition(page,'draft','Restore for fresh inspection');await page.getByRole('link',{name:'Preview this record privately'}).click();await expect(page.getByRole('heading',{name:/Private preview:/})).toBeVisible();await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);
 await page.goto(app+'/admin/inventory/browser-car');await page.getByLabel('Staff-only note').fill('PRIVATE_BROWSER_NOTE');await page.getByRole('button',{name:'Save private note'}).click();await reloadAfter(page,'Private operational note saved');
 await page.goto(app+'/admin/inventory/browser-car/preview');await expect(page.getByRole('heading',{name:/Private preview:/})).toBeVisible();expect(await page.content()).not.toContain('PRIVATE_BROWSER_NOTE');
 const publicResponse=await context.request.get(app+'/cars/browser-car');expect(await publicResponse.text()).not.toContain('PRIVATE_BROWSER_NOTE');
 await page.goto(app+'/admin/logs?vehicle=browser-car');await expect(page.locator('.admin-history').first()).toContainText('Explicit sale reversal');
 await publicPage.close();
});
test('stale editor preserves user input and inactive/pending/AAL1 sessions cannot edit stock',async({page,context,request})=>{
 await login(context,request,'staff','aal1');await createDraft(page,'stale-car');
 const stale=await context.newPage();await stale.goto(app+'/admin/inventory/stale-car');
 await page.getByLabel('Odometer (whole kilometres)').fill('12345');const actionRequestPromise=page.waitForRequest(r=>r.method()==='POST'&&!!r.headers()['next-action']);
 await page.getByRole('button',{name:'Save specifications'}).click();const actionRequest=await actionRequestPromise;await reloadAfter(page,'Saved stale-car');
 const denied=await context.request.post(actionRequest.url(),{headers:{'next-action':actionRequest.headers()['next-action'],'content-type':actionRequest.headers()['content-type'],origin:'https://evil.example.test'},data:actionRequest.postDataBuffer()!});expect(denied.status()).toBeGreaterThanOrEqual(400);
 await stale.getByLabel('Odometer (whole kilometres)').fill('98765');await stale.getByRole('button',{name:'Save specifications'}).click();await expect(stale.getByRole('status').filter({hasText:'This vehicle changed'})).toBeVisible();await expect(stale.getByLabel('Odometer (whole kilometres)')).toHaveValue('98765');await stale.close();
 for(const role of ['pending','inactive']){await login(context,request,role);await page.goto(app+'/admin/inventory/new');await expect(page.getByRole('heading',{name:'Inventory setup pending'})).toBeVisible();await expect(page.locator('form')).toHaveCount(0);}
 await login(context,request,'manager','aal1');await page.goto(app+'/admin/inventory');await expect(page).toHaveURL(/\/admin\/mfa$/);await expect(page.getByRole('button',{name:'Save specifications'})).toHaveCount(0);
});
test('unconfigured preview blocks nested staff inventory and uploads',async({page})=>{
 for(const route of ['/admin/inventory','/admin/inventory/new','/admin/inventory/legacy','/admin/inventory/legacy/preview','/admin/logs']){await page.goto(route);await expect(page.getByRole('heading',{name:'Inventory setup pending'})).toBeVisible();await expect(page.locator('form')).toHaveCount(0);}
});
