"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RoleSelectionPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"admin" | "participant" | null>(null);
  const [easterEggOpen, setEasterEggOpen] = useState(false);

  const handleRoleSelect = (role: "admin" | "participant") => {
    console.log("🎭 Role selected:", role);

    // Store role in localStorage for demo purposes
    if (typeof window !== "undefined") {
      localStorage.setItem("demo_role", role);
      localStorage.setItem("demo_user_id", `demo-${role}-${Date.now()}`);
      localStorage.setItem("demo_user_name", role === "admin" ? "관리자" : "김철수");
      // HTTP 쿠키 설정: 서버 사이드 createClient()에서 demo_role을 읽어 데모 유저 반환에 사용
      document.cookie = `demo_role=${role}; path=/; max-age=86400; SameSite=Lax`;
      console.log("✅ Role saved to localStorage and cookie");
    }

    // Navigate based on role
    const targetPath = role === "admin" ? "/admin" : "/";
    console.log("🚀 Navigating to:", targetPath);
    router.push(targetPath);
  };

  return (
    <>
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50">
      {/* Decorative elements */}
      <div className="absolute top-20 right-20 text-8xl opacity-10 rotate-12 pointer-events-none select-none animate-float hidden md:block">
        💰
      </div>
      <div className="absolute bottom-20 left-20 text-6xl opacity-10 -rotate-12 pointer-events-none select-none animate-bounce-slow hidden md:block">
        📊
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-8 rounded-3xl bg-white p-8 md:p-12 shadow-xl ring-1 ring-zinc-200 animate-fade-in-up">
        {/* Logo / Title area */}
        <div className="flex flex-col items-center gap-4 text-center">
          <button
            onClick={() => setEasterEggOpen(true)}
            className="w-24 h-24 rounded-3xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-5xl shadow-lg animate-celebrate hover:scale-105 transition-transform cursor-pointer focus:outline-none"
            aria-label="로고"
          >
            💰
          </button>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            아름드리꿈터
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
            자기주도 개인예산 관리 앱
          </p>
          <div className="mt-4 px-6 py-3 rounded-full bg-sky-100 text-sky-700 text-sm font-bold">
            🎭 역할을 선택해주세요
          </div>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-2 gap-6 mt-4">
          {/* Admin Card */}
          <button
            onClick={() => handleRoleSelect("admin")}
            onMouseEnter={() => setSelectedRole("admin")}
            onMouseLeave={() => setSelectedRole(null)}
            className={`group relative flex flex-col items-center gap-6 p-8 rounded-2xl border-3 transition-all duration-300 ${
              selectedRole === "admin"
                ? "border-purple-500 bg-purple-50 shadow-2xl scale-105"
                : "border-zinc-200 bg-white hover:border-purple-300 hover:shadow-lg hover:scale-102"
            }`}
          >
            <div
              className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl transition-all duration-300 ${
                selectedRole === "admin"
                  ? "bg-purple-600 shadow-lg scale-110"
                  : "bg-purple-100 group-hover:bg-purple-200"
              }`}
            >
              {selectedRole === "admin" ? "👨‍💼" : "🏢"}
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className={`text-2xl font-bold transition-colors ${
                selectedRole === "admin" ? "text-purple-700" : "text-zinc-800"
              }`}>
                관리자
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                당사자 관리, 지원자 배정,<br />
                예산 승인 및 모니터링
              </p>
            </div>

            <div className={`mt-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
              selectedRole === "admin"
                ? "bg-purple-600 text-white shadow-md"
                : "bg-purple-100 text-purple-700 group-hover:bg-purple-200"
            }`}>
              관리자로 시작하기
            </div>

            {/* Features List */}
            <ul className="w-full mt-4 space-y-2 text-xs text-left text-zinc-600">
              <li className="flex items-center gap-2">
                <span className="text-purple-500">✓</span>
                <span>전체 당사자 관리</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-500">✓</span>
                <span>통합 대시보드</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-500">✓</span>
                <span>권한 관리</span>
              </li>
            </ul>
          </button>

          {/* Participant Card */}
          <button
            onClick={() => handleRoleSelect("participant")}
            onMouseEnter={() => setSelectedRole("participant")}
            onMouseLeave={() => setSelectedRole(null)}
            className={`group relative flex flex-col items-center gap-6 p-8 rounded-2xl border-3 transition-all duration-300 ${
              selectedRole === "participant"
                ? "border-sky-500 bg-sky-50 shadow-2xl scale-105"
                : "border-zinc-200 bg-white hover:border-sky-300 hover:shadow-lg hover:scale-102"
            }`}
          >
            <div
              className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl transition-all duration-300 ${
                selectedRole === "participant"
                  ? "bg-sky-600 shadow-lg scale-110"
                  : "bg-sky-100 group-hover:bg-sky-200"
              }`}
            >
              {selectedRole === "participant" ? "👤" : "🙋"}
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className={`text-2xl font-bold transition-colors ${
                selectedRole === "participant" ? "text-sky-700" : "text-zinc-800"
              }`}>
                당사자
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                나의 예산 관리,<br />
                지출 기록 및 계획 수립
              </p>
            </div>

            <div className={`mt-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
              selectedRole === "participant"
                ? "bg-sky-600 text-white shadow-md"
                : "bg-sky-100 text-sky-700 group-hover:bg-sky-200"
            }`}>
              당사자로 시작하기
            </div>

            {/* Features List */}
            <ul className="w-full mt-4 space-y-2 text-xs text-left text-zinc-600">
              <li className="flex items-center gap-2">
                <span className="text-sky-500">✓</span>
                <span>나의 예산 현황</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-sky-500">✓</span>
                <span>지출 내역 기록</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-sky-500">✓</span>
                <span>계획 수립</span>
              </li>
            </ul>
          </button>
        </div>

        {/* Info Banner */}
        <div className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <div className="text-2xl">ℹ️</div>
            <div className="flex-1">
              <h3 className="font-bold text-amber-900 mb-2">데모 버전 안내</h3>
              <p className="text-sm text-amber-800 leading-relaxed">
                이 앱은 <strong>데모 모드</strong>로 실행 중입니다.
                로그인 없이 관리자 또는 당사자 화면을 자유롭게 체험하실 수 있습니다.
                데이터는 브라우저에만 저장되며 실제 서버에는 저장되지 않습니다.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground mt-4">
          <p>💡 언제든지 역할을 변경할 수 있습니다</p>
        </div>
      </div>
    </div>

    {/* 이스터에그 — 버트런드 러셀 인용구 */}
    {easterEggOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
        onClick={() => setEasterEggOpen(false)}
      >
        <div
          className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-2xl mb-4 text-center">💬</p>

          {/* 메인 인용구 */}
          <p className="text-sm text-slate-700 leading-relaxed mb-1">
            "훌륭한 삶이란 사랑으로 힘을 얻고 지식으로 길잡이를 삼는 삶이다."
          </p>
          <p className="text-xs text-slate-400 text-right mb-4">— 버트런드 러셀</p>
          <p className="text-xs text-slate-500 italic leading-relaxed mb-1">
            "The good life is one inspired by love and guided by knowledge."
          </p>
          <p className="text-xs text-slate-400 text-right mb-5">— Bertrand Russell</p>

          {/* 구분선 + 행복의 정복 인용구 */}
          <div className="h-px bg-slate-100 mb-4" />
          <p className="text-xs text-slate-500 leading-relaxed mb-1">
            "행복의 비결은 이것이다: 당신의 관심사를 가능한 한 넓게 키우고,
            당신의 관심사에 반응하는 것들에 대해 가능한 한 우호적으로 반응하라."
          </p>
          <p className="text-xs text-slate-400 text-right mb-5">
            — 버트런드 러셀, 《행복의 정복》
          </p>

          <div className="w-full rounded-xl overflow-hidden mb-5">
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
        </div>
      </div>
    )}
    </>
  );
}
