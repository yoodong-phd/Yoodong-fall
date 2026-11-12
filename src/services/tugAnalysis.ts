import type { Frame, TugState, Event } from "../types/assessment";
export const TUG_STATES: TugState[] = [
  "READY",
  "SIT_TO_STAND",
  "WALK_OUT",
  "TURN",
  "WALK_BACK",
  "STAND_TO_SIT",
  "COMPLETED",
];
export const TUG_LABELS: Record<TugState, string> = {
  READY: "준비",
  SIT_TO_STAND: "일어서기",
  WALK_OUT: "출발 보행",
  TURN: "방향 전환",
  WALK_BACK: "복귀 보행",
  STAND_TO_SIT: "앉기",
  COMPLETED: "완료",
};
export function nextState(state: TugState): TugState {
  return TUG_STATES[Math.min(TUG_STATES.indexOf(state) + 1, 6)];
}
// Exploratory image-plane proposals only. Never changes the standard examiner timer.
export function proposeTransition(
  state: TugState,
  frames: Frame[],
): TugState | null {
  const window = frames.slice(-12);
  if (
    window.length < 8 ||
    window.some((f) => !f.valid) ||
    window.at(-1)!.t - window[0].t < 400
  )
    return null;
  const a = window[0],
    b = window.at(-1)!;
  if (
    state === "SIT_TO_STAND" &&
    (b.kneeAngle ?? 0) > 155 &&
    (a.hipY ?? 0) - (b.hipY ?? 0) > 0.025
  )
    return "WALK_OUT";
  if (state === "TURN" && Math.abs((b.hipX ?? 0) - (a.hipX ?? 0)) > 0.03)
    return "WALK_BACK";
  if (
    state === "WALK_BACK" &&
    (b.kneeAngle ?? 180) < 145 &&
    (a.kneeAngle ?? 0) - (b.kneeAngle ?? 0) > 15 &&
    (b.hipY ?? 0) - (a.hipY ?? 0) > 0.02
  )
    return "STAND_TO_SIT";
  if (
    state === "STAND_TO_SIT" &&
    (b.kneeAngle ?? 180) < 115 &&
    (b.hipY ?? 0) - (a.hipY ?? 0) > 0.025
  )
    return "COMPLETED";
  // Reversal requires a visible excursion followed by sustained opposite movement.
  if (state === "WALK_OUT") {
    const good = frames.filter((f) => f.valid && f.hipX !== null);
    if (good.length < 25) return null;
    const origin = good[0].hipX!,
      xs = good.map((f) => f.hipX!);
    const lo = Math.min(...xs),
      hi = Math.max(...xs),
      current = b.hipX!;
    if (
      (hi - origin > 0.18 &&
        hi - current > 0.035 &&
        b.hipX! < a.hipX! - 0.015) ||
      (origin - lo > 0.18 && current - lo > 0.035 && b.hipX! > a.hipX! + 0.015)
    )
      return "TURN";
  }
  return null;
}
export function segments(events: Event[], end: number) {
  const manual = events.filter(
    (e) => e.source === "examiner" && TUG_STATES.includes(e.state as TugState),
  );
  return manual
    .filter((e) => e.state !== "COMPLETED" && e.state !== "READY")
    .map((e, i) => ({
      state: e.state,
      seconds: Math.max(0, ((manual[i + 1]?.t ?? end) - e.t) / 1000),
    }));
}
