'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type JobCreateResponse = {
  success?: boolean;
  data?: {
    jobId: string;
    pollUrl: string;
    pollIntervalMs?: number;
  };
  error?: string;
};

type JobPollResponse = {
  success?: boolean;
  data?: {
    status: 'queued' | 'running' | 'succeeded' | 'failed';
    progress: number;
    message: string;
    done: boolean;
    result?: {
      classroomId: string;
      url: string;
    };
    error?: string;
  };
  error?: string;
};

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return decodeURIComponent(
    atob(padded)
      .split('')
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''),
  );
}

function buildRequirement(markdown: string, title?: string): string {
  const header = title
    ? `请基于以下 Markdown 讲义生成一个完整课堂。讲义标题：${title}`
    : '请基于以下 Markdown 讲义生成一个完整课堂。';
  return `${header}\n\n--- Markdown 讲义开始 ---\n${markdown}\n--- Markdown 讲义结束 ---`;
}

export function ConnectMarkdownClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startedRef = useRef(false);

  const [statusText, setStatusText] = useState('准备中...');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const markdown = useMemo(() => {
    const md64 = searchParams.get('md64');
    if (md64) {
      try {
        return decodeBase64Url(md64);
      } catch {
        return '';
      }
    }

    return searchParams.get('markdown') || searchParams.get('md') || '';
  }, [searchParams]);

  const title = searchParams.get('title') || undefined;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!markdown.trim()) {
      setError('未检测到 Markdown 讲义内容，请通过 markdown 或 md64 参数传入。');
      return;
    }

    const requirement = buildRequirement(markdown, title);
    const controller = new AbortController();

    const run = async () => {
      try {
        setStatusText('正在创建课堂生成任务...');

        const createResp = await fetch('/api/generate-classroom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requirement,
            enableTTS: true,
          }),
          signal: controller.signal,
        });

        const createData = (await createResp.json()) as JobCreateResponse;
        if (!createResp.ok || !createData?.data?.pollUrl) {
          throw new Error(createData?.error || '创建课堂任务失败');
        }

        const pollUrl = createData.data.pollUrl;
        const pollIntervalMs = createData.data.pollIntervalMs || 3000;

        let done = false;
        while (!done) {
          const pollResp = await fetch(pollUrl, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
          });

          const pollData = (await pollResp.json()) as JobPollResponse;
          if (!pollResp.ok || !pollData?.data) {
            throw new Error(pollData?.error || '轮询课堂任务失败');
          }

          setStatusText(pollData.data.message || '生成中...');
          setProgress(pollData.data.progress || 0);

          if (pollData.data.done) {
            done = true;
            if (pollData.data.status === 'failed') {
              throw new Error(pollData.data.error || '课堂生成失败');
            }

            const targetUrl =
              pollData.data.result?.url ||
              (pollData.data.result?.classroomId
                ? `/classroom/${pollData.data.result.classroomId}`
                : '/');

            router.replace(targetUrl);
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : '处理失败');
      }
    };

    void run();

    return () => {
      controller.abort();
    };
  }, [markdown, router, title]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <div className="w-full max-w-xl rounded-2xl border bg-background p-6 shadow-sm space-y-4">
        <h1 className="text-xl font-semibold">正在根据外部讲义生成课堂</h1>
        {!error ? (
          <>
            <p className="text-sm text-muted-foreground">{statusText}</p>
            <div className="w-full h-2 rounded bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">进度 {Math.round(progress)}%</p>
          </>
        ) : (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={() => router.replace('/')}
              className="h-9 px-4 rounded-md border text-sm hover:bg-muted"
            >
              返回首页
            </button>
          </>
        )}
      </div>
    </main>
  );
}
