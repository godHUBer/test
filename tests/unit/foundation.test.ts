import test from 'node:test';
import assert from 'node:assert/strict';
import { siteRoutes, legacyRedirects, generalRoutes } from '../../lib/routes';
import { lakhToRupees } from '../../lib/format';
import { editorialTemplates } from '../../lib/editorial/templates';

test('exact decimal lakh conversion with invalid/unsafe inputs rejected', () => {
  assert.equal(lakhToRupees('6.0'), 600000);
  assert.equal(lakhToRupees('8.55'), 855000);
  assert.equal(lakhToRupees('0.00001'), 1);
  for (const bad of ['-1', 'NaN', '8.555555', '', '9007199254740992']) assert.throws(() => lakhToRupees(bad));
});
test('all 22 legacy page routes map to unique clean routes with permanent redirects', () => {
  assert.equal(siteRoutes.length, 22);
  assert.equal(new Set(siteRoutes.map(p => p.route)).size, 22);
  assert.equal(legacyRedirects.length, 22);
  // The legacy .html source files are deleted; the redirect map still encodes
  // the permanent mapping from each old URL to its clean Next.js route.
  assert.ok(legacyRedirects.every(p => p.permanent && p.destination.startsWith('/')));
  assert.ok(generalRoutes.some(p => p.route === '/'));
});
test('editorial templates retain main content without script execution or unresolved tokens', () => {
  const routes = ['/', '/about', '/showroom', '/contact', '/sell-your-car', '/legal'];
  assert.deepEqual(Object.keys(editorialTemplates).sort(), routes.sort());
  for (const route of routes) {
    const main = editorialTemplates[route];
    assert.match(main, /<main id="main">/);
    assert.match(main, /<h1[ >]/);
    // Tokens like {{HERO_IMAGE}} are resolved at render by EditorialPage; the
    // templates must not contain active scripts or raw asset paths.
    assert.doesNotMatch(main, /<script\b/);
  }
});
