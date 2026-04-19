'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';

interface AutoSigninProps {
  providerId: string;
  providerName: string;
  callbackUrl: string;
}

export function AutoSignin({ providerId, providerName, callbackUrl }: AutoSigninProps) {
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const triggerSignin = () => {
    return signIn(providerId, { redirectTo: callbackUrl }).catch((err) => {
      console.error('OAuth auto sign-in failed:', err);
      setError('自动跳转失败，请刷新页面后重试。');
    });
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void triggerSignin();
  }, [providerId, callbackUrl]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return <p className="text-sm text-muted-foreground">正在跳转到 {providerName} 登录页面...</p>;
}
