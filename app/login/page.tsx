import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { getOAuthProviderMetadata } from '@/auth';

interface LoginPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
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

  const callbackUrl = normalizeCallbackUrl(searchParams?.callbackUrl);
  const providers = getOAuthProviderMetadata();

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">登录 OpenMAIC</h1>
        <p className="text-sm text-muted-foreground mt-2">
          仅支持 OAuth 登录。请使用管理员在环境变量中配置的第三方账号。
        </p>

        <div className="mt-6 space-y-3">
          {providers.length === 0 && (
            <p className="text-sm text-destructive">
              未检测到可用 OAuth Provider，请先配置 AUTH_ENABLED_PROVIDERS 与对应凭据。
            </p>
          )}

          {providers.map((provider) => (
            <form
              key={provider.id}
              action={async () => {
                'use server';
                await signIn(provider.id, { redirectTo: callbackUrl });
              }}
            >
              <button
                type="submit"
                className="w-full h-10 rounded-lg border bg-background hover:bg-muted transition-colors text-sm font-medium"
              >
                使用 {provider.name} 登录
              </button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
