import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canDisconnectProvider,
  decideOAuthResolution,
  hashPassword,
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
