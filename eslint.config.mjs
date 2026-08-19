import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
