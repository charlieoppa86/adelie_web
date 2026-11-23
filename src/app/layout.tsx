import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "아델리 빙하 오피스", template: "%s · 아델리 빙하 오피스" },
  description: "선생 아델리와 학생 아델리가 함께 공부하는 빙하 위의 가상 공부방",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
