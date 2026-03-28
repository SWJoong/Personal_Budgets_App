"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validation
    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      setLoading(false);
      return;
    }

    // Check domain restrictions
    const allowedDomains = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS ?? 'nowondaycare.org').split(',');
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);

    if (!allowedDomains.some(d => email.endsWith('@' + d.trim())) && !adminEmails.includes(email)) {
      setError(`허용된 도메인(@${allowedDomains.join(', @')})의 이메일만 사용 가능합니다.`);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || email.split('@')[0],
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          setError("이미 등록된 이메일입니다.");
        } else {
          setError(error.message || "회원가입 중 오류가 발생했습니다.");
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      setError("회원가입 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50">
        <div className="flex w-full max-w-sm flex-col gap-6 rounded-3xl bg-white p-8 shadow-xl ring-1 ring-zinc-200 animate-fade-in-up">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-4xl animate-celebrate">
              ✅
            </div>
            <h2 className="text-2xl font-bold text-green-700">회원가입 완료!</h2>
            <p className="text-sm text-muted-foreground">
              계정이 생성되었습니다.<br />
              로그인 페이지로 이동합니다...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50">
      {/* Decorative elements */}
      <div className="absolute top-20 right-20 text-8xl opacity-10 rotate-12 pointer-events-none select-none animate-float hidden md:block">
        💰
      </div>
      <div className="absolute bottom-20 left-20 text-6xl opacity-10 -rotate-12 pointer-events-none select-none animate-bounce-slow hidden md:block">
        📊
      </div>

      <div className="flex w-full max-w-sm flex-col gap-6 rounded-3xl bg-white p-8 shadow-xl ring-1 ring-zinc-200 animate-fade-in-up">
        {/* Logo / Title area */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-20 h-20 rounded-3xl bg-sky-100 flex items-center justify-center text-4xl shadow-sm animate-celebrate">
            💰
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            회원가입
          </h1>
          <p className="text-balance text-sm text-muted-foreground leading-relaxed">
            아름드리꿈터 계정을 만드세요
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-danger/10 p-3 text-sm text-danger text-center font-medium ring-1 ring-danger/20 animate-fade-in-up">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-sm font-semibold text-zinc-700">
              이름 (선택)
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              className="px-4 py-3 rounded-xl border-2 border-zinc-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-semibold text-zinc-700">
              이메일 <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@nowondaycare.org"
              required
              className="px-4 py-3 rounded-xl border-2 border-zinc-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-semibold text-zinc-700">
              비밀번호 <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="최소 6자 이상"
              required
              minLength={6}
              className="px-4 py-3 rounded-xl border-2 border-zinc-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="confirmPassword" className="text-sm font-semibold text-zinc-700">
              비밀번호 확인 <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호 재입력"
              required
              minLength={6}
              className="px-4 py-3 rounded-xl border-2 border-zinc-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 rounded-xl bg-sky-600 px-4 py-4 text-sm font-bold text-white transition-all hover:bg-sky-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {loading ? "계정 생성 중..." : "회원가입"}
          </button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-sky-600 font-semibold hover:text-sky-700 hover:underline">
            로그인
          </Link>
        </div>

        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-amber-50 text-sm text-amber-700 border border-amber-200">
          <p className="font-bold text-amber-800">⚠️ 도메인 제한</p>
          <p className="text-xs">• 허용된 이메일 도메인만 가입 가능합니다</p>
          <p className="text-xs">• @nowondaycare.org 등</p>
        </div>
      </div>
    </div>
  );
}
