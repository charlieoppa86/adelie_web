import type { Metadata } from "next";
import { Library } from "@/components/library/Library";

// 로그인 뒤 화면이라 검색 결과에서 뺌 (브랜드 검색은 랜딩으로)
export const metadata: Metadata = { title: "자료실", robots: { index: false, follow: false } };

export default function LibraryPage() {
  return <Library />;
}
