import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 접근성 린트 강화(KRDS/KWCAG) — next/core-web-vitals 의 jsx-a11y 부분집합을 넘어
  // jsx-a11y/recommended 규칙 전체를 적용해 회귀를 CI(blocking)에서 자동 차단.
  // 플러그인 자체는 eslint-config-next 가 이미 'jsx-a11y' 로 등록하므로 rules 만 얹는다(재등록 충돌 방지).
  {
    files: ["**/*.{jsx,tsx}"],
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Phase C(#58 모달 통일 + PR-C2 폼 FormField·fieldset 리트로핏)로 아래 4규칙 위반을 0 으로 수렴 완료.
      // → recommended 기본값(error)으로 승격해 회귀를 CI(blocking)에서 자동 차단한다.
      // (핸드롤 모달의 오버레이 onClick·폼 레이블 미연결이 전부 프리미티브로 해소됨.)
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 앱 소스가 아닌 디렉터리 — 계획·설계·목업(자체 프로젝트/툴링). 앱 린트 대상 아님.
    "Plan&Source/**",
    "mockup_personal_budgets/**",
  ]),
]);

export default eslintConfig;
