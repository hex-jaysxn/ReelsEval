export type AuthProviderId = 'password' | 'google' | 'apple';

export interface ConnectedProvider {
  provider: AuthProviderId;
  email: string | null;
  displayName?: string | null;
  isPrivateRelay?: boolean;
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
  appleConfigured: boolean;
  passwordResetEmailConfigured: boolean;
  callbackUrls: {
    google: string;
    apple: string;
  };
}
