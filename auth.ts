import NextAuth from 'next-auth';

type OAuthProviderMeta = { id: string; name: string };

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function buildProviders(): Array<Record<string, unknown>> {
  const enabled = parseCsv(process.env.AUTH_ENABLED_PROVIDERS);
  const providers: Array<Record<string, unknown>> = [];

  const useOidc = enabled.length === 0 ? true : enabled.includes('oidc') || enabled.includes('oauth');
  if (
    useOidc &&
    process.env.AUTH_OIDC_ISSUER &&
    process.env.AUTH_OIDC_CLIENT_ID &&
    process.env.AUTH_OIDC_CLIENT_SECRET
  ) {
    providers.push({
      id: process.env.AUTH_OIDC_ID || 'oidc',
      name: process.env.AUTH_OIDC_NAME || 'OAuth',
      type: 'oidc',
      issuer: process.env.AUTH_OIDC_ISSUER,
      clientId: process.env.AUTH_OIDC_CLIENT_ID,
      clientSecret: process.env.AUTH_OIDC_CLIENT_SECRET,
      checks: ['pkce', 'state'],
    });
  }

  return providers;
}

const providers = buildProviders();

export function getOAuthProviderMetadata(): OAuthProviderMeta[] {
  return providers
    .map((provider) => ({
      id: (provider as { id?: string }).id || '',
      name: (provider as { name?: string }).name || '',
    }))
    .filter((provider) => provider.id && provider.name);
}

const authConfig = {
  providers,
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
