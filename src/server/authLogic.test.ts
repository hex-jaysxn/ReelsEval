import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canDisconnectProvider,
  decideOAuthResolution,
  generateNumericOtp,
  hashOtpCode,
  hashPassword,
  isHttpsRequestValues,
  maskEmailAddress,
  normalizeEmailFrom,
  parseSenderNameAndEmail,
  resolveEmailTransportConfig,
  resolveTrustedOpenerOrigin,
  verifyOtpCode,
  verifyPassword,
} from './authLogic.ts';
import { AppDatabase } from './db.ts';

test('scrypt hashPassword and verifyPassword verify valid and reject invalid passwords', async () => {
  const hash = await hashPassword('StrongPass123!');
  assert.ok(hash.startsWith('scrypt$'));
  assert.equal(await verifyPassword('StrongPass123!', hash), true);
  assert.equal(await verifyPassword('WrongPass123!', hash), false);
  assert.equal(await verifyPassword('StrongPass123!', null), false);
});

test('decideOAuthResolution safely links verified emails and prevents duplicates or hijack', () => {
  assert.deepEqual(
    decideOAuthResolution({
      existingIdentityUserId: null,
      existingEmailUserId: null,
      emailVerified: true,
      mode: 'login',
      sessionUserId: null,
    }),
    { action: 'create_user' }
  );

  assert.deepEqual(
    decideOAuthResolution({
      existingIdentityUserId: 'user-1',
      existingEmailUserId: 'user-1',
      emailVerified: true,
      mode: 'login',
      sessionUserId: null,
    }),
    { action: 'sign_in', targetUserId: 'user-1' }
  );

  // Existing email/password account + verified OAuth email -> safe auto-link
  assert.deepEqual(
    decideOAuthResolution({
      existingIdentityUserId: null,
      existingEmailUserId: 'user-1',
      emailVerified: true,
      mode: 'login',
      sessionUserId: null,
    }),
    { action: 'link_existing_email', targetUserId: 'user-1' }
  );

  // Unverified OAuth email must NOT auto-link to existing email/password account
  assert.equal(
    decideOAuthResolution({
      existingIdentityUserId: null,
      existingEmailUserId: 'user-1',
      emailVerified: false,
      mode: 'login',
      sessionUserId: null,
    }).action,
    'error'
  );

  // Account Settings linking checks
  assert.equal(
    decideOAuthResolution({
      existingIdentityUserId: 'other-user',
      existingEmailUserId: null,
      emailVerified: true,
      mode: 'link',
      sessionUserId: 'user-1',
    }).action,
    'error'
  );
  assert.deepEqual(
    decideOAuthResolution({
      existingIdentityUserId: null,
      existingEmailUserId: null,
      emailVerified: true,
      mode: 'link',
      sessionUserId: 'user-1',
    }),
    { action: 'link_to_session', targetUserId: 'user-1' }
  );
});

test('canDisconnectProvider prevents locking out user with no remaining auth method', () => {
  assert.equal(
    canDisconnectProvider({
      hasPassword: false,
      connectedOAuthProviders: ['google'],
      providerToRemove: 'google',
    }).allowed,
    false
  );
  assert.equal(
    canDisconnectProvider({
      hasPassword: true,
      connectedOAuthProviders: ['google'],
      providerToRemove: 'google',
    }).allowed,
    true
  );
});

test('AppDatabase supports unified email/password, Google, sessions, and resets', async () => {
  const db = new AppDatabase(':memory:');
  const pwHash = await hashPassword('InitialPass123!');
  const user = db.createUser({
    email: 'creator@example.com',
    emailVerified: true,
    name: 'Creator One',
    passwordHash: pwHash,
  });

  db.upsertOAuthIdentity({
    userId: user.id,
    provider: 'google',
    providerUserId: 'google-sub-1',
    providerEmail: 'creator@example.com',
    displayName: 'Creator One',
    avatarUrl: 'https://example.com/avatar.png',
  });

  const profile = db.getAuthUserProfile(user.id)!;
  assert.equal(profile.hasPassword, true);
  assert.equal(profile.connectedProviders.length, 2);
  assert.deepEqual(
    profile.connectedProviders.map((p) => p.provider),
    ['password', 'google']
  );

  // Session lifecycle
  const sessionToken = db.createSession(user.id);
  assert.equal(db.getSessionUser(sessionToken)?.id, user.id);
  db.deleteSession(sessionToken);
  assert.equal(db.getSessionUser(sessionToken), null);

  // Password reset single-use token
  const resetToken = db.createPasswordResetToken(user.id);
  assert.equal(db.consumePasswordResetToken(resetToken)?.userId, user.id);
  assert.equal(db.consumePasswordResetToken(resetToken), null);
});

test('OTP generation, salted verification, masking, and challenge attempt limits work securely', async () => {
  const otp = generateNumericOtp(6);
  assert.match(otp, /^\d{6}$/);

  const salt = 'test-salt-123';
  const hash = hashOtpCode(otp, salt);
  assert.equal(verifyOtpCode(otp, salt, hash), true);
  assert.equal(verifyOtpCode('000000', salt, hash), otp === '000000');
  assert.equal(verifyOtpCode('12345', salt, hash), false);
  assert.equal(maskEmailAddress('creator@example.com'), 'cr***@example.com');

  const db = new AppDatabase(':memory:');
  const pwHash = await hashPassword('InitialPass123!');
  const user = db.createUser({
    email: 'otpuser@example.com',
    emailVerified: false,
    name: 'OTP User',
    passwordHash: pwHash,
  });

  const challenge = db.createEmailOtpChallenge({
    purpose: 'login',
    userId: user.id,
    email: user.email,
    maxAttempts: 2,
  });

  // Wrong code increments attempts and rejects
  const wrongCode = challenge.otpCode === '111111' ? '222222' : '111111';
  const firstBad = db.verifyEmailOtpChallenge(challenge.challengeId, wrongCode);
  assert.deepEqual(firstBad, { status: 'invalid', attemptsRemaining: 1 });

  const secondBad = db.verifyEmailOtpChallenge(challenge.challengeId, wrongCode);
  assert.deepEqual(secondBad, { status: 'invalid', attemptsRemaining: 0 });

  const locked = db.verifyEmailOtpChallenge(challenge.challengeId, challenge.otpCode);
  assert.deepEqual(locked, { status: 'max_attempts' });

  // Resend cooldown + fresh challenge verification
  const fresh = db.createEmailOtpChallenge({
    purpose: 'register',
    userId: null,
    email: 'newuser@example.com',
    pendingName: 'New User',
    pendingPasswordHash: pwHash,
  });
  assert.equal(db.regenerateEmailOtpChallenge(fresh.challengeId, 30).status, 'cooldown');

  const verified = db.verifyEmailOtpChallenge(fresh.challengeId, fresh.otpCode);
  assert.equal(verified.status, 'verified');
  // Single-use: second attempt fails
  assert.equal(db.verifyEmailOtpChallenge(fresh.challengeId, fresh.otpCode).status, 'not_found');
});

test('normalizeEmailFrom cleans quotes, prefixes, and missing angle brackets while rejecting non-emails', () => {
  assert.equal(normalizeEmailFrom('onboarding@resend.dev'), 'onboarding@resend.dev');
  assert.equal(
    normalizeEmailFrom('ReeView <onboarding@resend.dev>'),
    'ReeView <onboarding@resend.dev>'
  );
  assert.equal(
    normalizeEmailFrom('"ReeView <onboarding@resend.dev>"'),
    'ReeView <onboarding@resend.dev>'
  );
  assert.equal(
    normalizeEmailFrom('EMAIL_FROM="ReeView <onboarding@resend.dev>"'),
    'ReeView <onboarding@resend.dev>'
  );
  assert.equal(
    normalizeEmailFrom('ReeView onboarding@resend.dev'),
    'ReeView <onboarding@resend.dev>'
  );
  assert.equal(
    normalizeEmailFrom('ReeView <onboarding@resend.dev'),
    'ReeView <onboarding@resend.dev>'
  );
  assert.equal(normalizeEmailFrom('<onboarding@resend.dev>'), 'onboarding@resend.dev');
  assert.equal(normalizeEmailFrom('ReeView'), null);
  assert.equal(normalizeEmailFrom('MY_EMAIL_FROM'), null);
  assert.equal(normalizeEmailFrom('resend.dev'), null);
  assert.equal(normalizeEmailFrom(''), null);
});

test('resolveEmailTransportConfig prioritizes Gmail/SMTP and Brevo cleanly over Resend', () => {
  // Gmail SMTP auto-detects host/port, strips App Password spaces, and ignores stale @resend.dev EMAIL_FROM
  const gmail = resolveEmailTransportConfig({
    SMTP_USER: 'jaysonapoya06@gmail.com',
    SMTP_PASS: 'abcd efgh ijkl mnop',
    EMAIL_FROM: 'ReeView <onboarding@resend.dev>',
    RESEND_API_KEY: 're_old_key',
  });
  assert.deepEqual(gmail, {
    provider: 'smtp',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: 'jaysonapoya06@gmail.com',
    pass: 'abcdefghijklmnop',
    from: 'ReeView <jaysonapoya06@gmail.com>',
  });

  // Explicit custom SMTP
  const customSmtp = resolveEmailTransportConfig({
    SMTP_HOST: 'smtp-relay.brevo.com',
    SMTP_PORT: '587',
    SMTP_USER: 'login@example.com',
    SMTP_PASS: 'secret-smtp-pass',
    EMAIL_FROM: 'ReeView <noreply@example.com>',
  });
  assert.deepEqual(customSmtp, {
    provider: 'smtp',
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    user: 'login@example.com',
    pass: 'secret-smtp-pass',
    from: 'ReeView <noreply@example.com>',
  });

  // Brevo HTTP API takes priority over Resend
  const brevo = resolveEmailTransportConfig({
    BREVO_API_KEY: 'xkeysib-123',
    RESEND_API_KEY: 're_123',
    EMAIL_FROM: 'ReeView <jaysonapoya06@gmail.com>',
  });
  assert.equal(brevo?.provider, 'brevo');
  assert.deepEqual(parseSenderNameAndEmail('ReeView <jaysonapoya06@gmail.com>'), {
    name: 'ReeView',
    email: 'jaysonapoya06@gmail.com',
  });

  // Resend fallback still works when neither SMTP nor Brevo is set
  const resend = resolveEmailTransportConfig({
    RESEND_API_KEY: 're_123',
    EMAIL_FROM: 'ReeView <noreply@example.com>',
  });
  assert.equal(resend?.provider, 'resend');

  // Empty/placeholder env returns null
  assert.equal(resolveEmailTransportConfig({}), null);
});

test('resolveTrustedOpenerOrigin allows custom domain and matching applet origins while rejecting untrusted hosts', () => {
  assert.equal(
    resolveTrustedOpenerOrigin({
      candidateOrigin: 'https://reeview.ai.studio',
      requestOrigin: 'https://ais-dev-izdz6evoejt6daj7gmjh6a-438790275501.asia-east1.run.app',
      appUrl: 'https://ais-dev-izdz6evoejt6daj7gmjh6a-438790275501.asia-east1.run.app',
    }),
    'https://reeview.ai.studio'
  );

  assert.equal(
    resolveTrustedOpenerOrigin({
      candidateOrigin: 'https://ais-pre-izdz6evoejt6daj7gmjh6a-438790275501.asia-east1.run.app',
      requestOrigin: 'https://ais-dev-izdz6evoejt6daj7gmjh6a-438790275501.asia-east1.run.app',
      appUrl: 'https://ais-dev-izdz6evoejt6daj7gmjh6a-438790275501.asia-east1.run.app',
    }),
    'https://ais-pre-izdz6evoejt6daj7gmjh6a-438790275501.asia-east1.run.app'
  );

  assert.equal(
    resolveTrustedOpenerOrigin({
      candidateOrigin: 'https://evil.example.com',
      requestOrigin: 'https://ais-dev-izdz6evoejt6daj7gmjh6a-438790275501.asia-east1.run.app',
      appUrl: 'https://ais-dev-izdz6evoejt6daj7gmjh6a-438790275501.asia-east1.run.app',
    }),
    'https://ais-dev-izdz6evoejt6daj7gmjh6a-438790275501.asia-east1.run.app'
  );
});

test('isHttpsRequestValues handles proxy proto casing without misclassifying local HTTP', () => {
  assert.equal(
    isHttpsRequestValues({ secure: false, forwardedProto: 'HTTPS, http' }),
    true
  );
  assert.equal(
    isHttpsRequestValues({ secure: false, originHeader: 'https://reeview.ai.studio' }),
    true
  );
  assert.equal(
    isHttpsRequestValues({ secure: false, forwardedProto: 'http', originHeader: 'http://localhost:3000' }),
    false
  );
});

test('AppDatabase preserves opener_origin on OAuth state and enforces single-use OAuth handoffs', () => {
  const db = new AppDatabase(':memory:');
  const user = db.createUser({
    email: 'googleuser@example.com',
    emailVerified: true,
    name: 'Google User',
  });

  const state = db.createOAuthState({
    provider: 'google',
    mode: 'login',
    userId: null,
    nonce: 'nonce-1',
    codeVerifier: 'verifier-1',
    redirectUri: 'https://ais-dev-test.run.app/api/auth/google/callback',
    openerOrigin: 'https://reeview.ai.studio',
  });

  const consumedState = db.consumeOAuthState(state, 'google');
  assert.equal(consumedState?.opener_origin, 'https://reeview.ai.studio');
  assert.equal(db.consumeOAuthState(state, 'google'), null);

  const handoffCode = db.createOAuthHandoff(user.id);
  assert.equal(db.consumeOAuthHandoff(handoffCode), user.id);
  assert.equal(db.consumeOAuthHandoff(handoffCode), null);
});

test('AppDatabase oauth_flows claim completes single-use flow and prevents duplicate tab handoff reuse', () => {
  const db = new AppDatabase(':memory:');
  const user = db.createUser({
    email: 'flowuser@example.com',
    emailVerified: true,
    name: 'Flow User',
  });

  const flowId = 'flow-secret-token-123';
  const state = db.createOAuthState({
    provider: 'google',
    mode: 'login',
    userId: null,
    nonce: 'nonce-flow',
    codeVerifier: 'verifier-flow',
    redirectUri: 'https://ais-dev-test.run.app/api/auth/google/callback',
    openerOrigin: 'https://reeview.ai.studio',
    flowId,
    flowType: 'popup',
  });

  const consumed = db.consumeOAuthState(state, 'google')!;
  assert.equal(consumed.flow_type, 'popup');
  assert.ok(consumed.flow_id_hash);
  assert.equal(db.isOAuthFlowClaimedByHash(consumed.flow_id_hash!), false);

  const handoffCode = db.createOAuthHandoff(user.id);
  db.completeOAuthFlowResult({
    flowIdHash: consumed.flow_id_hash,
    status: 'success',
    userId: user.id,
    handoffCode,
  });

  const flowStatus = db.getOAuthFlowStatus(flowId);
  assert.equal(flowStatus?.status, 'success');
  assert.equal(flowStatus?.claimed, 0);

  // Main tab claims via flowId -> marks claimed=1 AND deletes the unused handoffCode
  const claimed = db.claimOAuthFlow(flowId);
  assert.deepEqual(claimed, { userId: user.id, mode: 'login' });
  assert.equal(db.isOAuthFlowClaimedByHash(consumed.flow_id_hash!), true);
  assert.equal(db.claimOAuthFlow(flowId), null);
  assert.equal(db.consumeOAuthHandoff(handoffCode), null);
});
