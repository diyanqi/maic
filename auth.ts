import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import OIDC from 'next-auth/providers/oidc';

type OAuthProviderMeta = { id: string; name: string };

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function buildProviders(): NonNullable<NextAuthConfig['providers']> {
  const enabled = parseCsv(process.env.AUTH_ENABLED_PROVIDERS);
  const providers: NonNullable<NextAuthConfig['providers']> = [];

  const useOidc = enabled.length === 0 ? true : enabled.includes('oidc') || enabled.includes('oauth');
  if (
    useOidc &&
    process.env.AUTH_OIDC_ISSUER &&
    process.env.AUTH_OIDC_CLIENT_ID &&
    process.env.AUTH_OIDC_CLIENT_SECRET
  ) {
    providers.push(
      OIDC({
        id: process.env.AUTH_OIDC_ID || 'oidc',
        name: process.env.AUTH_OIDC_NAME || 'OAuth',
        issuer: process.env.AUTH_OIDC_ISSUER,
        clientId: process.env.AUTH_OIDC_CLIENT_ID,
        clientSecret: process.env.AUTH_OIDC_CLIENT_SECRET,
        checks: ['pkce', 'state'],
      }),
    );
  }

  return providers;
}

const providers = buildProviders();

export function getOAuthProviderMetadata(): OAuthProviderMeta[] {
  return providers
    .map((provider) => ({
      id: provider.id,
      name: provider.name,
    }))
    .filter((provider) => provider.id && provider.name);
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
