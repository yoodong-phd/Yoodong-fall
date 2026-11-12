import { screeningMessage } from "../src/services/screening";
import { describe, it, expect, vi } from "vitest";
import { angle, analyze, summarize } from "../src/utils/biomechanics";
import {
  elapsedSeconds,
  finishStage,
  canAdvance,
} from "../src/services/balanceAnalysis";
import {
  TUG_STATES,
  nextState,
  proposeTransition,
  segments,
} from "../src/services/tugAnalysis";
import { toCSV, toJSON, csvCell } from "../src/services/exportResults";
import { stopStream } from "../src/hooks/useCamera";
import type { Frame, Result, Point } from "../src/types/assessment";
const frame = (t: number, extra: Partial<Frame> = {}): Frame => ({
  t,
  confidence: 0.95,
  valid: true,
  hipX: 0.5,
  hipY: 0.6,
  shoulderX: 0.5,
  trunk: 0,
  hipAngle: 170,
  kneeAngle: 170,
  footX: 0.5,
  shoulderWidth: 0.2,
  landmarks: [],
  ...extra,
});
const result: Result = {
  id: "test",
  subject: {
    code: "P-001",
    age: "72",
    sex: "",
    date: "2026-11-12",
    examiner: "E1",
    aid: "없음",
    notes: "쉼표, 줄바꿈\n관찰",
  },
  kind: "tug",
  completed: true,
  seconds: 12,
  stages: [],
  frames: [frame(0), frame(100, { hipX: 0.54 })],
  events: [
    { t: 0, state: "SIT_TO_STAND", source: "examiner", note: "시작" },
    { t: 2000, state: "WALK_OUT", source: "automatic", note: "후보" },
    { t: 2200, state: "WALK_OUT", source: "examiner", note: "수동 확인" },
    { t: 12000, state: "COMPLETED", source: "examiner", note: "다시 앉음" },
  ],
  notes: "",
  normalization: "최초 어깨너비",
  endedAt: "2026-11-12T00:00:00Z",
};
describe("2D biomechanics", () => {
  it("calculates right, straight, and acute angles", () => {
    expect(angle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(
      90,
    );
    expect(angle({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(
      180,
    );
    expect(angle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(
      45,
    );
  });
  it("rejects coincident points", () =>
    expect(angle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull());
  it("handles lost/low confidence and out of frame tracking", () => {
    expect(analyze([], 0).valid).toBe(false);
    const p: Point[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: 0.9,
    }));
    p[27].visibility = 0.2;
    expect(analyze(p, 1).valid).toBe(false);
    p[27].visibility = 0.9;
    p[31].x = 1.1;
    expect(analyze(p, 2).valid).toBe(false);
  });
  it("corrects image aspect ratio before angles", () => {
    const p: Point[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: 0.95,
    }));
    p[11] = { x: 0.5, y: 0.3, visibility: 0.95 };
    p[23] = { x: 0.5, y: 0.5, visibility: 0.95 };
    p[25] = { x: 0.6, y: 0.6, visibility: 0.95 };
    expect(analyze(p, 0, 2).hipAngle).toBeCloseTo(116.565, 2);
  });
  it("normalizes using baseline shoulder width and reports gaps", () => {
    const s = summarize([
      frame(0),
      frame(1000, { hipX: 0.54 }),
      frame(1100, { valid: false }),
    ]);
    expect(s.hipExcursion).toBeCloseTo(0.2);
    expect(s.validRatio).toBeCloseTo(2 / 3);
    expect(s.frameGaps).toBe(1);
    expect(summarize([]).hipExcursion).toBeNull();
  });
});
describe("balance timing and stop rules", () => {
  it("uses precise milliseconds, caps at ten, never negative", () => {
    expect(elapsedSeconds(1000, 2523, 10)).toBeCloseTo(1.523);
    expect(elapsedSeconds(1000, 500, 10)).toBe(0);
    expect(elapsedSeconds(0, 10340, 10)).toBe(10);
  });
  it("advances only after confirmed full target", () => {
    expect(canAdvance(finishStage(0, 0, 10000, "목표 달성"))).toBe(true);
    expect(canAdvance(finishStage(0, 0, 9999, "검사자 균형 상실 판정"))).toBe(
      false,
    );
    expect(canAdvance(finishStage(1, 0, 10000, "외부 지지 필요"))).toBe(false);
    expect(canAdvance(finishStage(3, 0, 10000, "목표 달성"))).toBe(false);
  });
  it("creates fresh independent data for repeat assessments", () => {
    const a = finishStage(0, 0, 5000, "중단");
    a.frames.push(frame(0));
    const b = finishStage(0, 20000, 30000, "목표 달성");
    expect(b.seconds).toBe(10);
    expect(b.frames).toEqual([]);
    expect(b.events).toEqual([]);
  });
});
describe("TUG transitions", () => {
  it("follows the defined state order and stops at completed", () => {
    TUG_STATES.slice(0, -1).forEach((s, i) =>
      expect(nextState(s)).toBe(TUG_STATES[i + 1]),
    );
    expect(nextState("COMPLETED")).toBe("COMPLETED");
  });
  it("does not invent transitions with missing tracking", () => {
    expect(proposeTransition("SIT_TO_STAND", [])).toBeNull();
    expect(
      proposeTransition(
        "SIT_TO_STAND",
        Array.from({ length: 12 }, (_, i) => frame(i * 100, { valid: false })),
      ),
    ).toBeNull();
  });
  it("proposes standing and sitting from synthetic motion without altering examiner events", () => {
    const stand = Array.from({ length: 12 }, (_, i) =>
      frame(i * 100, { hipY: 0.7 - i * 0.006 }),
    );
    expect(proposeTransition("SIT_TO_STAND", stand)).toBe("WALK_OUT");
    const sit = stand.map((f, i) => ({
      ...f,
      hipY: 0.4 + i * 0.006,
      kneeAngle: 100,
    }));
    expect(proposeTransition("STAND_TO_SIT", sit)).toBe("COMPLETED");
  });
  it("proposes sitting down only with descending hip and knee flexion", () => {
    const f = Array.from({ length: 12 }, (_, i) =>
      frame(i * 100, { hipY: 0.5 + i * 0.004, kneeAngle: 170 - i * 3 }),
    );
    expect(proposeTransition("WALK_BACK", f)).toBe("STAND_TO_SIT");
    expect(
      proposeTransition(
        "WALK_BACK",
        f.map((x) => ({ ...x, valid: false })),
      ),
    ).toBeNull();
  });
  it("keeps automatic candidates separate from examiner segment timings", () => {
    const s = segments(result.events, 12000);
    expect(s[0].seconds).toBe(2.2);
    expect(s[1].seconds).toBe(9.8);
    expect(result.events[1].t).toBe(2000);
  });
  it("requires meaningful reversal before proposing turn", () => {
    const f = Array.from({ length: 40 }, (_, i) =>
      frame(i * 100, {
        hipX: i < 25 ? 0.3 + i * 0.01 : 0.55 - (i - 24) * 0.005,
      }),
    );
    expect(proposeTransition("WALK_OUT", f)).toBe("TURN");
    expect(proposeTransition("TURN", f)).toBe("WALK_BACK");
    expect(
      proposeTransition(
        "TURN",
        Array.from({ length: 12 }, (_, i) => frame(i * 100)),
      ),
    ).toBeNull();
  });
});
describe("exports and camera cleanup", () => {
  it("exports raw trajectories and both event sources as JSON", () => {
    const r = JSON.parse(toJSON(result));
    expect(r.frames).toHaveLength(2);
    expect(r.events[1].source).toBe("automatic");
    expect(r.events[2].source).toBe("examiner");
    expect(r.summary.hipExcursion).toBeCloseTo(0.2);
  });
  it("exports CSV measurement, quality and examiner correction fields", () => {
    const csv = toCSV(result);
    expect(csv).toContain("valid_frame_ratio");
    expect(csv).toContain("examiner_events");
    expect(csv).toContain("P-001");
    expect(csv).toContain("쉼표, 줄바꿈\n관찰");
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell("=SUM(A1)")).toBe('"\'=SUM(A1)"');
  });
  it("preserves manual correction data and original event times", () => {
    const corrected = {
      ...result,
      seconds: 13,
      events: [
        ...result.events,
        {
          t: 12000,
          state: "TIME_CORRECTION",
          source: "examiner" as const,
          note: "12 → 13 s: 스톱워치 확인",
        },
      ],
    };
    const r = JSON.parse(toJSON(corrected));
    expect(r.seconds).toBe(13);
    expect(r.events.at(-1).note).toContain("12 → 13");
    expect(r.events[3].t).toBe(12000);
  });
  it("stops every track and tolerates missing stream", () => {
    const a = { stop: vi.fn() },
      b = { stop: vi.fn() };
    stopStream({ getTracks: () => [a, b] } as unknown as MediaStream);
    expect(a.stop).toHaveBeenCalledOnce();
    expect(b.stop).toHaveBeenCalledOnce();
    expect(() => stopStream(null)).not.toThrow();
  });
});

describe("STEADI reference criteria", () => {
  it("uses the inclusive TUG 12 second boundary only for completed tests", () => {
    expect(screeningMessage(result)).toContain("12초 이상");
    expect(screeningMessage({ ...result, seconds: 11.99 })).toContain(
      "12초 미만",
    );
    expect(screeningMessage({ ...result, completed: false })).toContain(
      "적용하지 않습니다",
    );
  });
  it("does not classify absent or administratively aborted tandem as failure", () => {
    expect(screeningMessage({ ...result, kind: "balance" })).toContain(
      "미실시",
    );
    const stage = finishStage(2, 0, 5000, "검사자 중단");
    expect(
      screeningMessage({ ...result, kind: "balance", stages: [stage] }),
    ).toContain("중단 사유 확인 필요");
    stage.reason = "검사자 균형 상실 판정";
    expect(
      screeningMessage({ ...result, kind: "balance", stages: [stage] }),
    ).toContain("유지 실패");
  });
});
