import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { siteRoutes, legacyRedirects } from '../../lib/routes';
import { lakhToRupees } from '../../lib/format';

test('exact decimal lakh conversion with invalid/unsafe inputs rejected', () => {
  assert.equal(lakhToRupees('6.0'), 600000);
  assert.equal(lakhToRupees('8.55'), 855000);
  assert.equal(lakhToRupees('0.00001'), 1);
  for (const bad of ['-1', 'NaN', '8.555555', '', '9007199254740992']) assert.throws(() => lakhToRupees(bad));
});
test('all 22 legacy pages have unique clean routes and permanent redirects', () => {
  assert.equal(siteRoutes.length, 22);
  assert.equal(new Set(siteRoutes.map(p => p.route)).size, 22);
  assert.equal(legacyRedirects.length, 22);
  assert.ok(legacyRedirects.every(p => p.permanent && existsSync(p.source.slice(1))));
});
test('prepared compatibility pages retain main content without script execution or unresolved tokens', () => {
  const site = JSON.parse(readFileSync('.generated/site.json', 'utf8'));
  assert.equal(Object.keys(site.pages).length, 22);
  for (const { route } of siteRoutes) {
    const page = site.pages[route];
    assert.ok(page.title && page.description);
    assert.match(page.main, /<main id="main">/);
    assert.match(page.main, /<h1[ >]/);
    assert.doesNotMatch(page.main, /<script\b|\{\{|(?:src|href)="assets\//);
  }
  assert.match(site.pages['/cars/xl6-2025'].afterFooter, /data-lightbox/);
  assert.match(site.pages['/inventory'].main, /srcset="\/assets\//);
});
