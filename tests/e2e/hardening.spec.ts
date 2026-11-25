import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const app='http://127.0.0.1:3104';
async function audit(page:Page){const report=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(report.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);}
test('WCAG automated checks across public page families and mobile navigation',async({page})=>{
 for(const route of ['/','/inventory','/cars/creta-2018','/contact','/sell-your-car','/about','/showroom','/legal','/services','/admin/login','/admin/recovery']){await page.goto(route);await audit(page);}
 await page.setViewportSize({width:390,height:844});await page.goto('/contact');await page.getByRole('button',{name:'Menu',exact:true}).click();await expect(page.getByRole('dialog',{name:'Site menu'})).toBeVisible();await audit(page);
});
test('configured intake, catalogue, lead and settings screens pass automated accessibility checks',async({page,context,request})=>{
 for(const route of ['/contact','/sell-your-car','/services','/cars/phase5-view-car']){await page.goto(app+route);await audit(page);}
 const response=await request.get('https://localhost:3444/__session?role=manager');await context.addCookies([{name:'sb-localhost-auth-token',value:'base64-'+Buffer.from(JSON.stringify(await response.json())).toString('base64url'),url:app,httpOnly:true,sameSite:'Lax'}]);
 for(const route of ['/admin','/admin/inventory/new','/admin/business','/admin/services','/admin/settings','/admin/logs']){await page.goto(app+route);await audit(page);}
});
test('baseline browser security headers, private cache policy and credential isolation',async({page,request})=>{
 for(const route of ['/','/inventory','/services','/admin','/admin/login','/auth/callback']){
  const r=await request.get(route,{maxRedirects:0});const h=r.headers();expect(h['x-content-type-options'],route).toBe('nosniff');expect(h['permissions-policy'],route).toContain('camera=()');expect(h['content-security-policy'],route).toContain("object-src 'none'");
  if(route.startsWith('/admin')||route.startsWith('/auth')){expect(h['cache-control'],route).toMatch(/no-store/);expect(h['x-robots-tag'],route).toContain('noindex');expect(h['referrer-policy'],route).toBe('no-referrer');}
 }
 const r=await page.goto(app+'/contact');expect(r?.headers()['cache-control']).toMatch(/no-store/);
 const forbidden=['sb_secret_intake_fixture_only','sb_secret_media_fixture_only','local-test-only-intake-hash-secret-32-characters','synthetic-refresh'];
 const html=await page.content();for(const value of forbidden)expect(html).not.toContain(value);
 for(const src of await page.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>(n as HTMLScriptElement).src))){const script=await request.get(src);const body=await script.text();for(const value of forbidden)expect(body).not.toContain(value);}
});
test('320px intake success and private request detail reflow with long unbroken customer text',async({page,context,request})=>{
 await page.setViewportSize({width:320,height:900});await page.goto(app+'/contact');await page.getByLabel('Your name',{exact:false}).fill('X'.repeat(120));await page.getByLabel('Contact number').fill('+919000000444');await page.getByLabel('Question / preferred time').fill('Y'.repeat(3000));await page.getByRole('checkbox').check();
 await expect.poll(async()=>Date.now()-Number(await page.locator('input[name="issued"]').inputValue())).toBeGreaterThan(2100);await page.getByRole('button',{name:'Send request',exact:true}).click();await expect(page.locator('[data-request-reference]')).toBeVisible();const ref=await page.locator('[data-request-reference]').innerText();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await audit(page);
 const response=await request.get('https://localhost:3444/__session?role=manager');await context.addCookies([{name:'sb-localhost-auth-token',value:'base64-'+Buffer.from(JSON.stringify(await response.json())).toString('base64url'),url:app,httpOnly:true,sameSite:'Lax'}]);await page.goto(app+'/admin/business');await page.getByRole('link',{name:'general · '+ref.slice(0,8)}).click();await expect(page.getByRole('heading',{name:'X'.repeat(120),exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await audit(page);
});
