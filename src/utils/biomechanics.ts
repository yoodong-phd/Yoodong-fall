import type { Point, Frame } from "../types/assessment";
export const angle = (a: Point, b: Point, c: Point): number | null => {
  const ux = a.x - b.x,
    uy = a.y - b.y,
    vx = c.x - b.x,
    vy = c.y - b.y;
  const d = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (d < 1e-10) return null;
  return (
    (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / d))) * 180) /
    Math.PI
  );
};
const mid = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
export function analyze(points: Point[], t: number, aspect = 1): Frame {
  const required = [11, 12, 23, 24, 25, 26, 27, 28, 31, 32];
  const confidence =
    points.length >= 33
      ? Math.min(...required.map((i) => points[i].visibility ?? 0))
      : 0;
  const valid =
    confidence >= 0.6 &&
    required.every(
      (i) =>
        Number.isFinite(points[i]?.x) &&
        Number.isFinite(points[i]?.y) &&
        points[i].x > 0.01 &&
        points[i].x < 0.99 &&
        points[i].y > 0.01 &&
        points[i].y < 0.99,
    );
  const empty = {
    t,
    confidence,
    valid: false,
    hipX: null,
    hipY: null,
    shoulderX: null,
    trunk: null,
    hipAngle: null,
    kneeAngle: null,
    footX: null,
    shoulderWidth: null,
    landmarks: points,
  };
  if (!valid) return empty;
  // Scale normalized x to image-height units to preserve pixel aspect ratio for 2D angles.
  const p = points.map((q) => ({ ...q, x: q.x * aspect }));
  const hip = mid(p[23], p[24]),
    shoulder = mid(p[11], p[12]);
  const width = Math.hypot(p[11].x - p[12].x, p[11].y - p[12].y);
  return {
    ...empty,
    valid: true,
    hipX: hip.x,
    hipY: hip.y,
    shoulderX: shoulder.x,
    trunk: (Math.atan2(shoulder.x - hip.x, hip.y - shoulder.y) * 180) / Math.PI,
    hipAngle: angle(p[11], p[23], p[25]),
    kneeAngle: angle(p[23], p[25], p[27]),
    footX: (p[27].x + p[28].x + p[31].x + p[32].x) / 4,
    shoulderWidth: width,
  };
}
export const range = (values: number[]) =>
  values.length ? Math.max(...values) - Math.min(...values) : null;
export function summarize(frames: Frame[]) {
  const valid = frames.filter((f) => f.valid),
    baseline =
      valid.find((f) => (f.shoulderWidth ?? 0) > 0.02)?.shoulderWidth ?? null;
  const values = (key: keyof Frame) =>
    valid.map((f) => f[key]).filter((x): x is number => typeof x === "number");
  const normalized = (key: keyof Frame) => {
    const r = range(values(key));
    return r === null || baseline === null ? null : r / baseline;
  };
  const mean = (key: keyof Frame) => {
    const v = values(key);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const gaps = frames.slice(1).filter((f, i) => f.t - frames[i].t > 500).length;
  return {
    frames: frames.length,
    validFrames: valid.length,
    validRatio: frames.length ? valid.length / frames.length : null,
    meanConfidence: frames.length
      ? frames.reduce((a, f) => a + f.confidence, 0) / frames.length
      : null,
    hipExcursion: normalized("hipX"),
    shoulderExcursion: normalized("shoulderX"),
    footExcursion: normalized("footX"),
    trunkRange: range(values("trunk")),
    meanHipAngle: mean("hipAngle"),
    meanKneeAngle: mean("kneeAngle"),
    baselineShoulderWidth: baseline,
    frameGaps: gaps,
  };
}
