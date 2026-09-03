"use client";

import { useSearchParams } from "next/navigation";
import { useState, useTransition, Suspense } from "react";
import { createClient } from "@/utils/supabase/client";
import { demoSignIn, type DemoRole } from "@/app/actions/demoAuth";
import { Modal } from "@/components/ui/Modal";

const isDemoLoginEnabled = process.env.NEXT_PUBLIC_DEMO_LOGIN_ENABLED === "true";

// ────────────────────────────────────────────────────────────────
// 데모 로그인 — 실제로 시드된 Supabase Auth 계정에 로그인한다
// (쿠키를 직접 쓰는 스푸핑이 아니다. 일반 로그인과 동일한 RLS 를 탄다.)
// ────────────────────────────────────────────────────────────────

function DemoLoginSection() {
  const [pending, startTransition] = useTransition();
  const [pendingRole, setPendingRole] = useState<DemoRole | null>(null);
  const [error, setError] = useState("");

  const roles: { role: DemoRole; label: string; emoji: string }[] = [
    { role: "admin", label: "관리자로 둘러보기", emoji: "👨‍💼" },
    { role: "supporter", label: "담당자로 둘러보기", emoji: "🧑‍💻" },
    { role: "participant", label: "당사자로 둘러보기", emoji: "🙋" },
  ];

  const handleClick = (role: DemoRole) => {
    setError("");
    setPendingRole(role);
    startTransition(async () => {
      const result = await demoSignIn(role);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-zinc-50 border border-zinc-200">
      <p className="text-xs font-bold text-zinc-500">데모 계정으로 둘러보기</p>
      {error && <p className="text-xs text-red-600 leading-relaxed">{error}</p>}
      <div className="grid grid-cols-1 gap-2">
        {roles.map(({ role, label, emoji }) => (
          <button
            key={role}
            onClick={() => handleClick(role)}
            disabled={pending}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-400 transition-all font-bold text-sm text-zinc-700 disabled:opacity-60 min-h-[44px]"
          >
            <span>{emoji}</span>
            {pending && pendingRole === role ? "들어가는 중..." : label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Google OAuth 로그인 화면
// ────────────────────────────────────────────────────────────────

function GoogleLoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [loading, setLoading] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [easterEggOpen, setEasterEggOpen] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <>
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50">
        <div className="absolute top-20 right-20 text-8xl opacity-10 rotate-12 pointer-events-none select-none hidden md:block">
          💰
        </div>
        <div className="absolute bottom-20 left-20 text-6xl opacity-10 -rotate-12 pointer-events-none select-none hidden md:block">
          📊
        </div>

        <div className="flex w-full max-w-md flex-col gap-8 rounded-3xl bg-white p-8 md:p-12 shadow-xl ring-1 ring-zinc-200">
          {/* 로고 */}
          <div className="flex flex-col items-center gap-4 text-center">
            <button
              onClick={() => setEasterEggOpen(true)}
              className="w-24 h-24 rounded-3xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-5xl shadow-lg hover:scale-105 transition-transform focus:outline-none"
              aria-label="로고"
            >
              💰
            </button>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              서울형 개인예산제
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              선생님과 이용자가 함께 쓰는 앱이에요
            </p>
          </div>

          {/* 오류 메시지 */}
          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-800 leading-relaxed">
              <p className="font-bold mb-1">이 앱에 들어올 수 없는 이메일이에요.</p>
              <p>선생님이라면 기관 이메일로 로그인해주세요.</p>
              <p>이용자라면 담당 선생님께 문의해주세요.</p>
            </div>
          )}

          {/* Google 로그인 버튼 */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-2xl border-2 border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 transition-all font-bold text-zinc-800 text-base shadow-sm disabled:opacity-60 disabled:cursor-not-allowed min-h-[56px]"
          >
            {loading ? (
              <span className="text-sm text-zinc-500">로그인 중...</span>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
                구글로 로그인하기
              </>
            )}
          </button>

          {/* 안내 문구 */}
          <div className="text-center text-sm text-zinc-500 leading-relaxed space-y-1">
            <p>선생님: 기관 이메일로 로그인해주세요</p>
            <p>이용자: 담당 선생님께 문의해주세요</p>
          </div>

          {/* 데모 로그인 (NEXT_PUBLIC_DEMO_LOGIN_ENABLED=true 일 때만 노출) */}
          {isDemoLoginEnabled && <DemoLoginSection />}

          {/* 더 알아보기 */}
          <div className="rounded-2xl border border-zinc-200 overflow-hidden">
            <button
              onClick={() => setInfoOpen((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span>📖</span>
                <span>이 앱에 대해 더 알아보기</span>
              </span>
              <span className={`transition-transform duration-200 ${infoOpen ? "rotate-180" : ""}`}>
                ▼
              </span>
            </button>

            {infoOpen && (
              <div className="px-5 pb-5 pt-1 text-sm text-zinc-700 space-y-5 border-t border-zinc-100">
                <div>
                  <h2 className="font-bold text-zinc-800 mb-1.5">📋 프로젝트 개요</h2>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    발달장애인 당사자가 자신의 예산을 시각적으로 쉽게 이해하고 관리할 수 있도록 돕는 웹 앱입니다.
                    <strong> 쉬운 정보(Easy Read)</strong> 원칙을 적용해 당사자·지원자·관리자 세 역할을 지원합니다.
                  </p>
                </div>

                <div>
                  <h2 className="font-bold text-zinc-800 mb-1.5">✨ 주요 기능</h2>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-600">
                    <span>• SVG 주머니·지폐 잔액 시각화</span>
                    <span>• 영수증 OCR (Claude)</span>
                    <span>• 월별계획 · 전월 복사</span>
                    <span>• 지원목표 · 4+1 평가</span>
                    <span>• 이용계획서 자동 생성</span>
                    <span>• SIS-A 지원필요도 사정</span>
                    <span>• CSV 거래내역 가져오기</span>
                    <span>• 활동 지도 (카카오맵)</span>
                    <span>• TTS 음성 읽기</span>
                    <span>• AI 쉬운 요약</span>
                  </div>
                </div>

                <div>
                  <h2 className="font-bold text-zinc-800 mb-1.5">🏗️ 기술 스택</h2>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {["Next.js 15", "React 19", "TypeScript", "Tailwind CSS 4", "Supabase", "Claude", "Kakao Maps", "Vercel"].map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">{t}</span>
                    ))}
                  </div>
                </div>

                <a
                  href="https://github.com/SWJoong/Personal_Budgets_App"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-zinc-300 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  GitHub 저장소 보기
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 이스터에그 — Modal 프리미티브로 포커스 트랩/복원·Esc·scroll-lock 확보 */}
      <Modal
        open={easterEggOpen}
        onClose={() => setEasterEggOpen(false)}
        label="버트런드 러셀 인용"
        containerClassName="flex items-center justify-center p-6"
        overlayClassName="bg-black/60 backdrop-blur-sm"
        panelClassName="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl"
      >
        <p className="text-2xl mb-4 text-center">💬</p>
        <p className="text-sm text-slate-700 leading-relaxed mb-1">
          &quot;훌륭한 삶이란 사랑으로 힘을 얻고 지식으로 길잡이를 삼는 삶이다.&quot;
        </p>
        <p className="text-xs text-slate-400 text-right mb-4">— 버트런드 러셀</p>
        <p className="text-xs text-slate-500 italic leading-relaxed mb-1">
          &quot;The good life is one inspired by love and guided by knowledge.&quot;
        </p>
        <p className="text-xs text-slate-400 text-right mb-5">— Bertrand Russell</p>
        <div className="h-px bg-slate-100 mb-4" />
        <p className="text-xs text-slate-500 leading-relaxed mb-1">
          &quot;행복의 비결은 이것이다: 당신의 관심사를 가능한 한 넓게 키우고,
          당신의 관심사에 반응하는 것들에 대해 가능한 한 우호적으로 반응하라.&quot;
        </p>
        <p className="text-xs text-slate-400 text-right mb-5">— 버트런드 러셀, 《행복의 정복》</p>
        <div className="w-full rounded-xl overflow-hidden mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- 정적 이스터에그 이미지, next/image 최적화 불필요 */}
          <img
            src="/images/26oJy.jpg"
            alt="이스터에그 이미지"
            className="w-full object-contain max-h-48"
          />
        </div>
        <button
          onClick={() => setEasterEggOpen(false)}
          className="w-full py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-700 transition-colors"
        >
          닫기
        </button>
      </Modal>
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// 페이지 진입점 — 구글 로그인 + (활성화 시) 데모 로그인을 함께 보여준다
// ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-zinc-400">로딩 중...</div>
      </div>
    }>
      <GoogleLoginContent />
    </Suspense>
  );
}
