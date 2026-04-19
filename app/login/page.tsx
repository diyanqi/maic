import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getOAuthProviderMetadata } from '@/auth';
import { AutoSignin } from './auto-signin';

interface LoginPageProps {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}

function normalizeCallbackUrl(value: string | string[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) return '/';
  return first.startsWith('/') ? first : '/';
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user) {
    redirect('/');
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const callbackUrl = normalizeCallbackUrl(resolvedSearchParams.callbackUrl);
  const providers = getOAuthProviderMetadata();
  const defaultProvider = providers[0];

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">登录 OpenMAIC</h1>
        {/* <p className="text-sm text-muted-foreground mt-2">
          仅支持 OAuth 登录。请使用管理员在环境变量中配置的第三方账号。
        </p> */}

        <div className="mt-6 space-y-3">
          {providers.length === 0 && (
            <p className="text-sm text-destructive">
              未检测到可用 OAuth Provider，请先配置 AUTH_ENABLED_PROVIDERS 与对应凭据。
            </p>
          )}

          {defaultProvider && (
            <AutoSignin
              providerId={defaultProvider.id}
              providerName={defaultProvider.name}
              callbackUrl={callbackUrl}
            />
          )}
        </div>
      </div>
    </main>
  );
}
