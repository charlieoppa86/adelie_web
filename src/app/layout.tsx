import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MobileNotice } from "@/components/MobileNotice";

export const metadata: Metadata = {
  title: { default: "남극캠퍼스.ai", template: "%s · 남극캠퍼스.ai" },
  description: "강사 아델리와 학생 아델리가 함께 AI를 공부하는 남극 위의 가상 스터디룸",
  icons: {
    icon: [{ url: "/brand/favicon.svg", type: "image/svg+xml" }],
    apple: "/brand/apple-touch-icon.png",
  },
};

export const viewport: Viewport = { themeColor: "#060d19" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        {/* 모바일이면 잠시 뒤 PC 이용 안내 (입장 화면·스터디룸 모두) */}
        <MobileNotice />
      </body>
    </html>
  );
}
