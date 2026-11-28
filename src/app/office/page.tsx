import type { Metadata } from "next";
import { Office } from "@/components/office/Office";

// 로그인 뒤 화면이라 검색 결과에서 뺌 (브랜드 검색은 랜딩으로)
export const metadata: Metadata = { title: "스터디룸", robots: { index: false, follow: false } };

export default function OfficePage() {
  return <Office />;
}
