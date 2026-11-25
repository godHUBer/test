import test from 'node:test';
import assert from 'node:assert/strict';
import { authConfig } from '../../lib/supabase/config';
import { canEnter, hasRecentTotp, needsMfa, validEmail, validPassword } from '../../lib/auth/policy';

test('only active recognised database roles enter; legacy editors remain unprivileged', () => {
  const profile = { user_id: 'local-test', role: 'staff', is_active: true, display_name: null };
  assert.equal(canEnter(profile), true);
  for (const role of ['editor','pending','admin','superuser','']) assert.equal(canEnter({ ...profile, role }), false);
  assert.equal(canEnter({ ...profile, is_active: false }), false);
  assert.equal(canEnter(null), false);
  assert.equal(needsMfa('owner'), true);
  assert.equal(needsMfa('manager'), true);
  assert.equal(needsMfa('staff'), false);
});
test('privileged changes require fresh TOTP, not old passwords or future timestamps', () => {
  assert.equal(hasRecentTotp([{ method: 'totp', timestamp: 950 }], 1000), true);
  assert.equal(hasRecentTotp([{ method: 'password', timestamp: 950 }], 1000), false);
  assert.equal(hasRecentTotp([{ method: 'totp', timestamp: 1 }], 1000), false);
  assert.equal(hasRecentTotp([{ method: 'totp', timestamp: 5000 }], 1000), false);
  assert.equal(hasRecentTotp(null), false);
});
test('password/email validation has explicit bounds', () => {
  assert.equal(validEmail('staff@example.test'), true);
  for (const value of ['missing-at','a@b','a @example.test']) assert.equal(validEmail(value), false);
  assert.equal(validPassword('long-unique-test-password'), true);
  assert.equal(validPassword('short'), false);
  assert.equal(validPassword('x'.repeat(129)), false);
});
test('auth configuration fails closed without HTTPS and rejects privileged public keys', () => {
  const original = { ...process.env };
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SITE_URL;
    assert.equal(authConfig(), null);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_local-test-only';
    process.env.SITE_URL = 'https://staff.example.test';
    assert.equal(authConfig()?.origin, 'https://staff.example.test');
    for(const url of ['https://bad:pass@example.supabase.co/','https://example.supabase.co/path','https://example.supabase.co/?key=x','https://example.supabase.co/#fragment']){process.env.NEXT_PUBLIC_SUPABASE_URL=url;assert.equal(authConfig(),null);}
    process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_secret_rejected';
    assert.equal(authConfig(), null);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'eyJ.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.test';
    assert.equal(authConfig(), null);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_local-test-only';
    for (const origin of ['http://staff.example.test','https://staff.example.test/path','https://bad:pass@example.test/','https://staff.example.test/?next=evil']) {
      process.env.SITE_URL = origin;
      assert.equal(authConfig(), null);
    }
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
});
