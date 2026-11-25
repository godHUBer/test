import {test,expect} from '@playwright/test';
const live='http://127.0.0.1:3102';const fixture='https://localhost:3443';
test.beforeEach(async({request})=>{expect((await request.get(fixture+'/__scenario?name=normal')).status()).toBe(200);});
test('database-backed filters, pagination, fresh slugs and safe public projections',async({page,request})=>{
  await page.context().addCookies([{name:'staff_session_test_only',value:'never-forward-this',url:live}]);
  await page.goto(live+'/inventory');await expect(page.locator('[data-count]')).toHaveText('16');await expect(page.locator('article.veh')).toHaveCount(12);
  await expect(page.locator('.source-notice')).not.toContainText('Snapshot preview');
  await page.getByRole('link',{name:'Next',exact:true}).click();await expect(page.locator('article.veh')).toHaveCount(4);
  expect(page.url()).toContain('page=2');
  await page.goto(live+'/inventory?make=Test%20Motors&sort=price');await expect(page.locator('[data-count]')).toHaveText('1');
  await page.goto(live+'/inventory?budget=3-5&fuel=Petrol&q=Fresh&sort=price');await expect(page.locator('[data-count]')).toHaveText('1');
  await page.goto(live+'/cars/new-arrival');await expect(page.locator('main h1')).toHaveText('2018 Test Motors Fresh Model');
  await expect(page.locator('main')).toContainText('Public <script>alert("xss")</script> variant');
  await expect(page.locator('main script:not([type="application/ld+json"])')).toHaveCount(0);
  const html=await page.content();expect(html).not.toContain('PRIVATE_CANARY');expect(html).not.toContain('DO_NOT_EXPOSE');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://dealer.example.test/cars/new-arrival');
  const schema=JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);expect(schema.offers.availability).toBe('https://schema.org/InStock');expect(schema.offers.price).toBe(425000);
  expect((await request.get(live+'/cars/private-draft')).status()).toBe(404);expect((await request.get(live+'/cars/private-hidden')).status()).toBe(404);expect((await request.get(live+'/cars/old-archive')).status()).toBe(404);
  const calls=await (await request.get(fixture+'/__requests')).json();
  expect(calls.length).toBeGreaterThan(0);
  for(const call of calls){expect(call.method).toBe('GET');expect(call.publicKey).toBe(true);expect(call.publicAuthorization).toBe(true);expect(call.hasCookie).toBe(false);expect(call.query.select).not.toContain('*');expect(call.path).toMatch(/\/rest\/v1\/(cars|brand_settings)$/);}
});
test('sale removes featured stock and dropdown choices on next request, preserves a sold detail',async({page,request})=>{
  await page.goto(live+'/');await expect(page.locator('.veh-hero')).toContainText('Fresh Model');
  await request.get(fixture+'/__scenario?name=sold');
  await page.goto(live+'/');await expect(page.locator('.veh-hero')).not.toContainText('Fresh Model');
  await page.goto(live+'/inventory');await expect(page.locator('[data-count]')).toHaveText('15');await expect(page.locator('article.veh').filter({hasText:'Fresh Model'})).toHaveCount(0);
  await page.goto(live+'/contact');await expect(page.locator('#q-car option').filter({hasText:'Fresh Model'})).toHaveCount(0);await expect(page.locator('.contact-grid')).toContainText('Confirmed fixture hours');
  await page.goto(live+'/cars/new-arrival');await expect(page.getByRole('heading',{name:'This car has been sold.'})).toBeVisible();await expect(page.locator('#enquire')).toHaveCount(0);await expect(page.locator('[data-prefill-viewing]')).toHaveCount(0);
  expect(JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!).offers.availability).toBe('https://schema.org/SoldOut');
  const sitemap=await (await request.get(live+'/sitemap.xml')).text();expect(sitemap).not.toContain('/cars/new-arrival');expect(sitemap).not.toContain('/admin');
});
test('reserved remains visible only as an unavailable detail; hidden returns 404',async({page,request})=>{
  await request.get(fixture+'/__scenario?name=reserved');await page.goto(live+'/cars/new-arrival');await expect(page.getByRole('heading',{name:'This car is reserved.'})).toBeVisible();await expect(page.locator('#enquire')).toHaveCount(0);
  await page.goto(live+'/inventory?make=Test%20Motors');await expect(page.locator('[data-count]')).toHaveText('0');
  await request.get(fixture+'/__scenario?name=hidden');expect((await request.get(live+'/cars/new-arrival')).status()).toBe(404);
});
test('empty, one-record, broken-media and outage states do not fabricate stock',async({page,request})=>{
  await request.get(fixture+'/__scenario?name=empty');await page.goto(live+'/inventory');await expect(page.getByRole('heading',{name:'No available vehicles are published'})).toBeVisible();await expect(page.locator('article.veh')).toHaveCount(0);
  await page.goto(live+'/');await expect(page.locator('.veh-hero')).toHaveCount(0);await expect(page.getByRole('heading',{name:'No available listings are published'}).first()).toBeVisible();
  await request.get(fixture+'/__scenario?name=one');await page.goto(live+'/');await expect(page.locator('.veh-hero')).toHaveCount(1);await page.goto(live+'/cars/new-arrival');await expect(page.getByRole('heading',{name:'Available alternatives'})).toHaveCount(0);
  await request.get(fixture+'/__scenario?name=bad-media');await page.goto(live+'/cars/new-arrival');await expect(page.getByText('No photographs have been published for this vehicle.')).toBeVisible();await expect(page.locator('img[src^="javascript:"]')).toHaveCount(0);
  await request.get(fixture+'/__scenario?name=error');await page.goto(live+'/inventory');await expect(page.getByRole('heading',{name:'We could not load the inventory'})).toBeVisible();await expect(page.locator('article.veh')).toHaveCount(0);await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);
  await page.goto(live+'/cars/new-arrival');await expect(page.getByRole('heading',{name:'We could not load this vehicle'})).toBeVisible();
});
test('snapshot previews have no sale offers and robots block indexing; live sitemap uses current slugs',async({page,request})=>{
  await page.goto('/cars/xl6-2025');await expect(page.locator('.source-notice')).toContainText('Snapshot preview');await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /');
  const sitemap=await (await request.get(live+'/sitemap.xml')).text();expect(sitemap).toContain('https://dealer.example.test/cars/new-arrival');expect(sitemap).not.toContain('private-draft');
});


test('unexpected private status rows are rejected instead of rendered',async({page,request})=>{
  await request.get(fixture+'/__scenario?name=leak');
  await page.goto(live+'/inventory');await expect(page.getByRole('heading',{name:'We could not load the inventory'})).toBeVisible();
  await expect(page.locator('article.veh')).toHaveCount(0);expect(await page.content()).not.toContain('private-draft');
});
