import type { BalanceStage } from "../types/assessment";
export const STANCES = [
  "나란히 서기",
  "반일렬 서기",
  "일렬 서기",
  "한 발 서기",
];
export const STANCE_EN = [
  "Side-by-side",
  "Semi-tandem",
  "Tandem",
  "Single-leg",
];
export const INSTRUCTIONS = [
  "두 발을 나란히 모으고 섭니다.",
  "한 발의 안쪽이 반대 발 엄지발가락 옆에 닿도록 섭니다.",
  "앞발의 뒤꿈치와 뒷발의 발끝을 붙여 일렬로 섭니다.",
  "한쪽 발을 바닥에서 들고 한 발로 섭니다.",
];
export const elapsedSeconds = (start: number, now: number, cap = Infinity) =>
  Math.max(0, Math.min(cap, (now - start) / 1000));
export function finishStage(
  stage: number,
  start: number,
  now: number,
  reason: string,
): BalanceStage {
  const seconds = elapsedSeconds(start, now, 10);
  return {
    stage,
    seconds,
    passed: seconds >= 10 && reason === "목표 달성",
    reason,
    frames: [],
    events: [],
  };
}
export const canAdvance = (stage: BalanceStage) =>
  stage.passed && stage.stage < 3;
