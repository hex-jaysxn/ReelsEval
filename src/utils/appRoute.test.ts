import test from 'node:test';
import assert from 'node:assert/strict';
import { getRoutePath, parseAppRoute } from './appRoute.ts';

test('parseAppRoute resolves /, /privacy, and /terms including trailing slashes and casing', () => {
  assert.equal(parseAppRoute('/'), 'main');
  assert.equal(parseAppRoute(''), 'main');
  assert.equal(parseAppRoute('/privacy'), 'privacy');
  assert.equal(parseAppRoute('/privacy/'), 'privacy');
  assert.equal(parseAppRoute('/PRIVACY'), 'privacy');
  assert.equal(parseAppRoute('/terms'), 'terms');
  assert.equal(parseAppRoute('/terms/'), 'terms');
  assert.equal(parseAppRoute('/other'), 'main');

  assert.equal(getRoutePath('main'), '/');
  assert.equal(getRoutePath('privacy'), '/privacy');
  assert.equal(getRoutePath('terms'), '/terms');
});
