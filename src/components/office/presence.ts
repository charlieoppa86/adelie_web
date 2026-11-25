import type { PenguinAnim, PenguinPose } from "@/components/penguin/Penguin";
import { SEAT_BY_ID } from "@/shared/officeMap";
import type { PlayerState } from "@/shared/protocol";

export interface Presence {
  pose: PenguinPose;
  anim: PenguinAnim[];
  status: { emoji: string; label: string; studying: boolean };
}

/** 펭귄의 자리·움직임으로 포즈와 상태를 정합니다. */
export function presenceOf(p: PlayerState): Presence {
  const cap = p.role === "teacher";
  const seat = p.seatId ? SEAT_BY_ID[p.seatId] : undefined;

  if (p.moving) {
    return { pose: { cap }, anim: ["waddle"], status: { emoji: "🐾", label: "돌아다니는 중", studying: false } };
  }
  if (!seat) {
    return { pose: { cap }, anim: [], status: { emoji: "👀", label: "둘러보는 중", studying: false } };
  }
  const laptop = seat.prop !== "book";
  const holding: PenguinPose = { cap, laptop, book: !laptop, look: [0, 4] };
  const studyAnim: PenguinAnim[] = laptop ? ["type"] : ["tilt"];
  switch (seat.kind) {
    case "desk":
      return { pose: holding, anim: studyAnim, status: { emoji: "✏️", label: "집중 공부 중", studying: true } };
    case "standing":
      return { pose: holding, anim: studyAnim, status: { emoji: "🧍", label: "스탠딩 공부 중", studying: true } };
    case "cafe":
      return { pose: holding, anim: studyAnim, status: { emoji: "☕", label: "카페 공부 중", studying: true } };
    case "sofa":
      return { pose: { cap, expr: "happy" }, anim: [], status: { emoji: "🛋️", label: "쉬는 중", studying: false } };
  }
}

export const ROLE_LABEL: Record<PlayerState["role"], string> = {
  student: "학생",
  teacher: "강사",
  admin: "관리자",
};

export function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "1분 미만";
  const h = Math.floor(m / 60);
  return h ? `${h}시간 ${m % 60}분` : `${m}분`;
}

export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}
