import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAuthApiResponse } from './authResponse.ts';

test('parseAuthApiResponse handles OTP, user session, JSON error, HTML 200 proxy, and empty responses', () => {
  const otpRes = parseAuthApiResponse({
    ok: true,
    status: 200,
    contentType: 'application/json',
    rawBody: JSON.stringify({
      otpRequired: true,
      purpose: 'login',
      challengeId: 'abc',
      maskedEmail: 'cr***@example.com',
    }),
  });
  assert.equal(otpRes.ok, true);
  if (otpRes.ok) {
    assert.equal(otpRes.data.otpRequired, true);
    assert.equal(otpRes.data.challengeId, 'abc');
  }

  const htmlProxy200 = parseAuthApiResponse({
    ok: true,
    status: 200,
    contentType: 'text/html; charset=utf-8',
    rawBody: '<!doctype html><html><body>Auth Refresh</body></html>',
  });
  assert.equal(htmlProxy200.ok, false);
  if (!htmlProxy200.ok) {
    assert.equal(htmlProxy200.error.code, 'SESSION_OR_PROXY_HTML');
    assert.match(htmlProxy200.error.message, /HTML page instead of JSON/i);
    assert.match(htmlProxy200.error.message, /new browser tab/i);
  }

  const empty200 = parseAuthApiResponse({
    ok: true,
    status: 200,
    contentType: 'application/json',
    rawBody: '',
  });
  assert.equal(empty200.ok, false);
  if (!empty200.ok) {
    assert.equal(empty200.error.code, 'EMPTY_RESPONSE');
  }

  const serverErr = parseAuthApiResponse({
    ok: false,
    status: 502,
    contentType: 'application/json',
    rawBody: JSON.stringify({
      error: {
        code: 'EMAIL_DELIVERY_FAILED',
        message: 'Email service rejected RESEND_API_KEY.',
      },
    }),
  });
  assert.equal(serverErr.ok, false);
  if (!serverErr.ok) {
    assert.equal(serverErr.error.code, 'EMAIL_DELIVERY_FAILED');
    assert.match(serverErr.error.message, /RESEND_API_KEY/);
  }
});
