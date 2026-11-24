export type AuthProviderId = 'password' | 'google';

export interface ConnectedProvider {
  provider: AuthProviderId;
  email: string | null;
  displayName?: string | null;
  connectedAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string | null;
  hasPassword: boolean;
  connectedProviders: ConnectedProvider[];
  createdAt: string;
}

export interface AuthProviderAvailability {
  googleConfigured: boolean;
  emailOtpConfigured: boolean;
  passwordResetEmailConfigured: boolean;
  callbackUrls: {
    google: string;
  };
}
