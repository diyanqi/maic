'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';

interface AutoSigninProps {
  providerId: string;
  providerName: string;
  callbackUrl: string;
  auto?: boolean;
}

export function AutoSignin({ providerId, providerName, callbackUrl, auto = true }: AutoSigninProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const startedRef = useRef(false);

  const triggerSignin = () => {
    setLoading(true);
    return signIn(providerId, { redirectTo: callbackUrl }).catch((err) => {
      console.error('OAuth auto sign-in failed:', err);
      setError('自动跳转失败，请刷新页面后重试。');
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!auto) return;
    if (startedRef.current) return;
    startedRef.current = true;

    void triggerSignin();
  }, [auto, providerId, callbackUrl]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!auto) {
    return (
      <button
        type="button"
        onClick={() => void triggerSignin()}
        disabled={loading}
        className="w-full h-10 rounded-lg border bg-background hover:bg-muted transition-colors text-sm font-medium"
      >
        {loading ? '正在跳转...' : `使用 ${providerName} 登录`}
      </button>
    );
  }

  return <p className="text-sm text-muted-foreground">正在跳转到 {providerName} 登录页面...</p>;
}
