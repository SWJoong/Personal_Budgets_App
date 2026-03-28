"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useState } from "react";

function LoginForm() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const errorParam = searchParams.get("error");
  let errorMessage = "";
  if (errorParam === "InvalidDomain") {
    errorMessage = "허용되지 않은 계정입니다. 관리자에게 문의하세요.";
  } else if (errorParam) {
    errorMessage = "로그인에 실패했습니다. 다시 시도해 주세요.";
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        setLoading(false);
        return;
      }

      // Check domain restrictions
      const allowedDomains = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS ?? 'nowondaycare.org').split(',');
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);

      if (!allowedDomains.some(d => email.endsWith('@' + d.trim())) && !adminEmails.includes(email)) {
        await supabase.auth.signOut();
        setError("허용되지 않은 도메인입니다. 관리자에게 문의하세요.");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError("로그인 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full max-w-sm flex-col gap-6 rounded-3xl bg-white p-8 shadow-xl ring-1 ring-zinc-200 animate-fade-in-up">
      {/* Logo / Title area */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-20 h-20 rounded-3xl bg-sky-100 flex items-center justify-center text-4xl shadow-sm animate-celebrate">
          💰
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          아름드리꿈터
        </h1>
        <p className="text-balance text-sm text-muted-foreground leading-relaxed">
          자기주도 개인예산 관리 앱에<br />오신 것을 환영합니다.
        </p>
      </div>

      {(errorMessage || error) && (
        <div className="rounded-xl bg-danger/10 p-3 text-sm text-danger text-center font-medium ring-1 ring-danger/20 animate-fade-in-up">
          {error || errorMessage}
        </div>
      )}

      <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-semibold text-zinc-700">
            이메일
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="px-4 py-3 rounded-xl border-2 border-zinc-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-semibold text-zinc-700">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="px-4 py-3 rounded-xl border-2 border-zinc-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 rounded-xl bg-sky-600 px-4 py-4 text-sm font-bold text-white transition-all hover:bg-sky-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <div className="text-center text-sm text-muted-foreground">
        계정이 없으신가요?{" "}
        <Link href="/signup" className="text-sky-600 font-semibold hover:text-sky-700 hover:underline">
          회원가입
        </Link>
      </div>

      <div className="flex flex-col gap-2 mt-2 p-4 rounded-2xl bg-sky-50 text-sm text-sky-700">
        <p className="font-bold text-sky-800">💡 안내</p>
        <p>• 이메일과 비밀번호로 로그인하세요</p>
        <p>• 계정이 없다면 회원가입을 먼저 진행하세요</p>
        <p>• 관리자 승인 후 사용 가능합니다</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50">
      {/* Decorative elements */}
      <div className="absolute top-20 right-20 text-8xl opacity-10 rotate-12 pointer-events-none select-none animate-float hidden md:block">
        💰
      </div>
      <div className="absolute bottom-20 left-20 text-6xl opacity-10 -rotate-12 pointer-events-none select-none animate-bounce-slow hidden md:block">
        📊
      </div>

      <Suspense fallback={<div className="text-sm text-muted-foreground animate-pulse-gentle">로딩 중...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
