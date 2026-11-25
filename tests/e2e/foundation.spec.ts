import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { siteRoutes } from '../../lib/routes';

for (const width of [320, 390, 768, 1440]) {
  test(`all 22 pages have content, assets and no overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    for (const { route } of siteRoutes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('main')).toHaveCount(1);
      if(route==='/'){
        const navBox=await page.locator('nav[aria-label="Main"]').boundingBox();
        const noticeBox=await page.locator('.source-notice').boundingBox();
        expect(noticeBox!.y).toBeGreaterThanOrEqual(navBox!.y+navBox!.height-1);
      }
      await page.evaluate(async () => {
        document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
        await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {})));
        await document.fonts.ready;
      });
      const broken = await page.evaluate(() => Array.from(document.images).filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src));
      expect(broken, route).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
      expect(await page.locator('main').textContent(), route).not.toContain('{{');
    }
    expect(errors).toEqual([]);
  });
}

test('every legacy URL permanently redirects; query survives and unknown pages are 404', async ({ request }) => {
  for (const { source, route } of siteRoutes) {
    const response = await request.get(`/${source}?body=SUV&sort=price`, { maxRedirects: 0 });
    expect(response.status(), source).toBe(308);
    const destination = new URL(response.headers().location, 'http://127.0.0.1:3100');
    expect(destination.pathname).toBe(route);
    expect(destination.searchParams.get('body')).toBe('SUV');
  }
  expect((await request.get('/cars/not-a-real-car')).status()).toBe(404);
  expect((await request.get('/admin/users')).status()).toBe(404);
});

test('filters, gallery, form validation and non-functional admin placeholder are honest', async ({ page }) => {
  await page.goto('/inventory?body=SUV&sort=price');
  await expect(page.locator('[data-count]')).toHaveText('6');
  await page.locator('[data-clear]').click();
  await expect(page.locator('[data-count]')).toHaveText('15');
  await page.goto('/cars/xl6-2025');
  await page.locator('[data-gallery-next]').click();
  await expect(page.locator('[data-gallery-count]')).toHaveText('2 / 3');
  await page.locator('[data-lightbox-open]').click();
  await expect(page.locator('[data-lightbox]')).toHaveClass(/is-open/);
  await expect(page.locator('[data-lightbox-close]')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.lightbox__cap')).toContainText('3 / 3');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-lightbox]')).not.toHaveClass(/is-open/);
  await page.goto('/contact');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('.form__status')).toContainText('Please complete');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin setup pending' })).toBeVisible();
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('mobile menu traps focus and returns it on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const open = page.locator('[data-sheet-open]');
  await open.click();
  await expect(open).toHaveAttribute('aria-expanded', 'true');
  const controls = page.locator('#sheet a, #sheet button');
  await expect(controls.first()).toBeVisible();
  await expect(controls.first()).toBeFocused();
  await controls.last().focus();
  await page.keyboard.press('Tab');
  await expect(controls.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(controls.last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(open).toBeFocused();
  await expect(open).toHaveAttribute('aria-expanded', 'false');
});

test('capture legacy and application baseline screenshots for each page family', async ({ page, context }, info) => {
  // Interception serves only local baseline files. No outbound legacy.test traffic.
  const legacy = await context.newPage();
  await legacy.route('http://legacy.test/**', async route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const file = resolve(process.cwd(), '.' + pathname);
    if (!file.startsWith(process.cwd() + '/')) return route.abort();
    const body = await readFile(file);
    const contentType = file.endsWith('.html') ? 'text/html' : file.endsWith('.woff2') ? 'font/woff2' : file.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    await route.fulfill({ body, contentType });
  });
  for (const width of [390, 1440]) {
    for (const item of [...siteRoutes.slice(0, 7), siteRoutes.find(p => p.route === '/cars/xl6-2025')!]) {
      const name = item.source.replace('.html', '');
      for (const [label, target, url] of [
        ['legacy', legacy, `http://legacy.test/${item.source}`],
        ['app', page, item.route],
      ] as const) {
        await target.setViewportSize({ width, height: 960 });
        await target.goto(url);
        await target.evaluate(() => document.fonts.ready);
        await target.screenshot({ path: info.outputPath(`${name}-${width}-${label}.png`), animations: 'disabled' });
      }
    }
  }
  await legacy.close();
});


test('public content and navigation remain available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3100/inventory');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('article.veh')).toHaveCount(12);
  await expect(page.locator('a[href="/cars/xl6-2025"]').first()).toBeVisible();
  await page.getByRole('link',{name:'Next',exact:true}).click();
  await expect(page.locator('article.veh')).toHaveCount(3);
  await page.goto('http://127.0.0.1:3100/contact');
  await expect(page.locator('form[data-mailto]')).toHaveAttribute('method','post');
  await expect(page.locator('form[data-mailto]')).toHaveAttribute('action',/^mailto:/);
  await context.close();
});

test('auth routes fail closed without configuration and disclose no credentials', async ({ page, request }) => {
  for (const route of ['/admin/login','/admin/recovery','/admin/password','/admin/mfa','/admin/confirm']) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    expect(response?.headers()['cache-control']).toContain('no-store');
    expect(response?.headers()['x-robots-tag']).toContain('noindex');
    expect(response?.headers()['referrer-policy']).toBe('no-referrer');
  }
  const callback = await request.get('/auth/callback?code=invalid&next=https://evil.example.test', { maxRedirects: 0 });
  expect(callback.status()).toBe(503);
  expect(callback.headers().location).toBeUndefined();
  expect((await request.get('/auth/confirm?token_hash=fake&type=invite')).status()).toBe(400);
  expect((await request.post('/auth/confirm', { form: { type: 'invite', token_hash: 'fake' } })).status()).toBe(503);
});
