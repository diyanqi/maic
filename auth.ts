import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';

type OAuthProviderMeta = { id: string; name: string };
type AuthProvider = NonNullable<NextAuthConfig['providers']>[number];

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function buildProviders(): {
  providers: NonNullable<NextAuthConfig['providers']>;
  metadata: OAuthProviderMeta[];
} {
  const enabled = parseCsv(process.env.AUTH_ENABLED_PROVIDERS);
  const providers: NonNullable<NextAuthConfig['providers']> = [];
  const metadata: OAuthProviderMeta[] = [];

  const useOidc = enabled.length === 0 ? true : enabled.includes('oidc') || enabled.includes('oauth');
  if (
    useOidc &&
    process.env.AUTH_OIDC_ISSUER &&
    process.env.AUTH_OIDC_CLIENT_ID &&
    process.env.AUTH_OIDC_CLIENT_SECRET
  ) {
    const id = process.env.AUTH_OIDC_ID || 'oidc';
    const name = process.env.AUTH_OIDC_NAME || 'OAuth';
    providers.push({
      id,
      name,
      type: 'oidc',
      issuer: process.env.AUTH_OIDC_ISSUER,
      clientId: process.env.AUTH_OIDC_CLIENT_ID,
      clientSecret: process.env.AUTH_OIDC_CLIENT_SECRET,
      checks: ['pkce', 'state'],
    } as AuthProvider);
    metadata.push({ id, name });
  }

  return { providers, metadata };
}

const { providers, metadata } = buildProviders();

export function getOAuthProviderMetadata(): OAuthProviderMeta[] {
  return metadata;
}

const authConfig: NextAuthConfig = {
  providers,
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
