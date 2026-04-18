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

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function pickText(...values: unknown[]): string | undefined {
  for (const value of values) {
    const parsed = normalizeText(value);
    if (parsed) return parsed;
  }
  return undefined;
}

function normalizeOAuthProfile(profile: Record<string, unknown>) {
  const id = pickText(profile.sub, profile.id, profile.user_id, profile.uid, profile.username);
  const email = pickText(profile.email, profile.mail);
  const name = pickText(
    profile.name,
    profile.preferred_username,
    profile.nickname,
    profile.given_name,
    email,
  );
  const image = pickText(profile.picture, profile.avatar_url, profile.avatar);

  return {
    id: id || email || name || 'oauth-user',
    name: name || email || id || 'OAuth User',
    email,
    image,
  };
}

function buildProviders(): {
  providers: NonNullable<NextAuthConfig['providers']>;
  metadata: OAuthProviderMeta[];
} {
  const enabled = parseCsv(process.env.AUTH_ENABLED_PROVIDERS);
  const providers: NonNullable<NextAuthConfig['providers']> = [];
  const metadata: OAuthProviderMeta[] = [];

  const useOidc = enabled.length === 0 ? true : enabled.includes('oidc') || enabled.includes('oauth');

  const clientId = normalizeText(process.env.AUTH_OIDC_CLIENT_ID);
  const clientSecret = normalizeText(process.env.AUTH_OIDC_CLIENT_SECRET);
  const issuer = normalizeText(process.env.AUTH_OIDC_ISSUER);
  const authorizationUrl = normalizeText(process.env.AUTH_OIDC_AUTHORIZATION_URL);
  const tokenUrl = normalizeText(process.env.AUTH_OIDC_TOKEN_URL);
  const userinfoUrl = normalizeText(process.env.AUTH_OIDC_USERINFO_URL);
  const scope = normalizeText(process.env.AUTH_OIDC_SCOPE) || 'openid profile email';

  if (
    useOidc &&
    clientId &&
    clientSecret &&
    ((authorizationUrl && tokenUrl) || issuer)
  ) {
    const id = process.env.AUTH_OIDC_ID || 'oidc';
    const name = process.env.AUTH_OIDC_NAME || 'OAuth';

    if (authorizationUrl && tokenUrl) {
      const customOAuthProvider: Record<string, unknown> = {
        id,
        name,
        type: 'oauth',
        clientId,
        clientSecret,
        checks: ['pkce', 'state'],
        authorization: {
          url: authorizationUrl,
          params: { scope },
        },
        token: tokenUrl,
        profile: (profile: Record<string, unknown>) => normalizeOAuthProfile(profile),
      };

      if (userinfoUrl) {
        customOAuthProvider.userinfo = userinfoUrl;
      }

      providers.push(customOAuthProvider as unknown as AuthProvider);
    } else {
      providers.push({
        id,
        name,
        type: 'oidc',
        issuer,
        clientId,
        clientSecret,
        checks: ['pkce', 'state'],
      } as AuthProvider);
    }

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

export default authConfig;