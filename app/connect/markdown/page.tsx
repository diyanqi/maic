import { Suspense } from 'react';
import { ConnectMarkdownClient } from './connect-markdown-client';

function Fallback() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <div className="w-full max-w-xl rounded-2xl border bg-background p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">准备中...</p>
      </div>
    </main>
  );
}

export default function ConnectMarkdownPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <ConnectMarkdownClient />
    </Suspense>
  );
}
