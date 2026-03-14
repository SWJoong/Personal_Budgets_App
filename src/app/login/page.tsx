"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const error = searchParams.get("error");
  let errorMessage = "";
  if (error === "InvalidDomain") {
    errorMessage = "@nowondaycare.org 계정으로만 로그인할 수 있습니다.";
  } else if (error) {
    errorMessage = "로그인에 실패했습니다. 다시 시도해 주세요.";
  }

  const handleGoogleLogin = async () => {
    setLoading(true);
    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : "";

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });

    if (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl bg-card p-8 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          로그인
        </h1>
        <p className="text-balance text-sm text-zinc-500">
          아름드리꿈터 개인예산 관리 앱에 오신 것을 환영합니다.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger text-center font-medium">
          {errorMessage}
        </div>
      )}

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg bg-foreground px-4 py-3 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {loading ? "연결 중..." : "Google 계정으로 로그인"}
      </button>

      <div className="text-center text-xs text-zinc-500">
        @nowondaycare.org 계정만 사용 가능합니다.
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
      <Suspense fallback={<div className="text-sm text-zinc-500">로딩 중...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
