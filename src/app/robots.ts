import type { MetadataRoute } from "next";

/**
 * 스터디룸(앱) 검색 설정 — 소개 · 검색 노출은 랜딩(adelie-ai.vercel.app)이 담당.
 * 로그인 뒤 화면(/office · /library)은 각 페이지의 noindex 로 검색에서 뺌
 * (robots.txt 로 막으면 검색엔진이 noindex 를 못 읽어 주소만 노출될 수 있어 막지 않음)
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" } };
}
