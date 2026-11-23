/**
 * 매시간 바뀌는 남극 날씨.
 * 시각(시간 단위)으로 정해지므로 서버 없이도 모든 사람이 같은 날씨를 봅니다.
 */

export type WeatherId = "clear" | "snow" | "blizzard" | "aurora" | "fog" | "diamond";

export interface Weather {
  id: WeatherId;
  emoji: string;
  label: string;
  /** 날씨가 바뀔 때 띄우는 한 줄 */
  announce: string;
}

export const WEATHERS: Record<WeatherId, Weather> = {
  clear: { id: "clear", emoji: "☀️", label: "맑음", announce: "햇살이 빙붕을 반짝 비춰요" },
  snow: { id: "snow", emoji: "🌨️", label: "함박눈", announce: "포근한 함박눈이 내려요" },
  blizzard: { id: "blizzard", emoji: "🌬️", label: "눈보라", announce: "눈보라가 몰아쳐요! 꼭 붙어 있어요" },
  aurora: { id: "aurora", emoji: "🌌", label: "오로라 밤", announce: "하늘에 오로라가 춤춰요" },
  fog: { id: "fog", emoji: "🌫️", label: "해무", announce: "바다 안개가 천천히 밀려와요" },
  diamond: { id: "diamond", emoji: "✨", label: "다이아몬드 더스트", announce: "공기 중 얼음 결정이 반짝여요" },
};

export const WEATHER_ORDER: WeatherId[] = ["clear", "snow", "blizzard", "aurora", "fog", "diamond"];

const HOUR = 3_600_000;

/** 정수 해시 (시간 번호 → 의사 난수) */
function hash(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

function rawWeather(hourIndex: number): WeatherId {
  return WEATHER_ORDER[hash(hourIndex) % WEATHER_ORDER.length];
}

/**
 * 해당 시각의 날씨. 바로 전 시간에 "보여준" 날씨와 같으면 다른 날씨로 넘겨 매시간 꼭 바뀌게 합니다.
 * (하루 전부터 차례로 계산 — 24번 반복이라 가벼움)
 */
export function weatherAt(ms: number): WeatherId {
  const h = Math.floor(ms / HOUR);
  let prev = rawWeather(h - 24);
  for (let i = h - 23; i <= h; i++) {
    let cur = rawWeather(i);
    if (cur === prev) {
      const shift = 1 + (hash(i * 31) % (WEATHER_ORDER.length - 1));
      cur = WEATHER_ORDER[(WEATHER_ORDER.indexOf(cur) + shift) % WEATHER_ORDER.length];
    }
    prev = cur;
  }
  return prev;
}

export function nextChangeAt(ms: number): number {
  return (Math.floor(ms / HOUR) + 1) * HOUR;
}
