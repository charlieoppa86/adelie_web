import { EntryForm } from "@/components/EntryForm";

/**
 * 입장 화면: 랜딩의 "입장하기"에서 바로 넘어오므로 소개 없이
 * Google 로그인 → (처음이면) 닉네임 → 입장 카드만 가운데에 보여 줍니다.
 */
export default function Home() {
  return (
    <main className="glacier-sky flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16">
      <h1 className="sr-only">남극AI빌리지 입장</h1>
      <EntryForm />
    </main>
  );
}
