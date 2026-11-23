import Image from "next/image";
import { Penguin } from "@/components/penguin/Penguin";
import { EntryForm } from "@/components/EntryForm";

/**
 * 입장 화면. 지금은 임시 입장 폼(닉네임·역할)이고,
 * 마지막 단계에서 Google 로그인으로 교체합니다.
 */
export default function Home() {
  return (
    <main className="glacier-sky flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div className="flex items-center gap-3">
        <Image src="/brand/logo-mark.svg" alt="" width={44} height={44} priority />
        <span className="text-xl font-extrabold tracking-tight">
          아델리<span className="text-brand-400">.ai</span>
        </span>
      </div>

      <h1 className="mt-8 text-center text-4xl font-extrabold leading-tight sm:text-5xl">
        남극{" "}
        <span className="bg-gradient-to-r from-[#6cd0f5] via-aurora-green to-[#a99cff] bg-clip-text text-transparent">
          AI 스터디룸
        </span>
      </h1>
      <p className="mt-4 max-w-md text-center text-ink-300">
        선생 아델리와 학생 아델리가 남극 빙붕 위에 모여 AI를 공부해요. 누가 출석했는지 실시간으로 보고, 말풍선으로 대화해요.
      </p>

      {/* 펭귄 미리보기: 선생 1 + 학생 3 */}
      <div className="mt-10 flex items-end justify-center gap-2 sm:gap-4" aria-label="공부하는 펭귄들">
        <Penguin cap pointer wave="r" anim={["waddle", "point"]} className="w-28 sm:w-36" title="선생 아델리" />
        <Penguin laptop look={[0, 4]} anim={["type"]} delay={0.2} className="w-24 sm:w-28" title="노트북으로 공부하는 학생 아델리" />
        <Penguin book expr="happy" anim={["waddle"]} delay={0.4} className="w-24 sm:w-28" title="책을 읽는 학생 아델리" />
        <Penguin laptop sparkles anim={["bounce", "type"]} delay={0.1} className="w-24 sm:w-28" title="신난 학생 아델리" />
      </div>
      <div className="h-6 w-full max-w-xl rounded-[50%] bg-brand-200/20 ring-1 ring-brand-200/40" aria-hidden="true" />

      <EntryForm />
    </main>
  );
}
