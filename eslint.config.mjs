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
      // 진행 중 카테고리 — Phase C(FormField·Modal 리트로핏)에서 위반을 0 으로 수렴시킨 뒤 error 로 승격 예정.
      // 지금 error 로 두면 진행 중 위반(폼 레이블·핸드롤 모달)이 CI 를 막아 #55/#56 병렬 진행을 방해하므로 warn.
      // 나머지 recommended 규칙(현재 위반 0)은 error 로 회귀를 차단한다.
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
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
