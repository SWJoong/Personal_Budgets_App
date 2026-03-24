import type { Metadata } from "next";
import "./globals.css";
import { AccessibilityProvider } from "@/hooks/useAccessibility";

export const metadata: Metadata = {
  title: "아름드리꿈터 개인예산 관리",
  description: "아름드리꿈터 자기주도 개인예산 관리 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="antialiased text-gray-900 bg-gray-50">
        <AccessibilityProvider>
          {children}
        </AccessibilityProvider>
      </body>
    </html>
  );
}
