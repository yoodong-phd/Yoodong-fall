import type { Result } from "../types/assessment";
import { summarize } from "../utils/biomechanics";
import { segments } from "./tugAnalysis";
export function toJSON(result: Result) {
  return JSON.stringify(
    {
      ...result,
      summary: summarize(result.frames),
      segments:
        result.kind === "tug"
          ? segments(result.events, result.seconds * 1000)
          : [],
    },
    null,
    2,
  );
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function toCSV(r: Result) {
  const s = summarize(r.frames);
  const row = {
    subject_code: r.subject.code,
    age: r.subject.age,
    sex: r.subject.sex,
    date: r.subject.date,
    examiner: r.subject.examiner,
    aid: r.subject.aid,
    test: r.kind,
    completed: r.completed,
    total_seconds: r.seconds,
    stage_times: JSON.stringify(
      r.stages.map((x) => ({
        stage: x.stage + 1,
        seconds: x.seconds,
        passed: x.passed,
        reason: x.reason,
      })),
    ),
    tug_segments: JSON.stringify(
      r.kind === "tug" ? segments(r.events, r.seconds * 1000) : [],
    ),
    automatic_detections: r.events.filter((e) => e.source === "automatic")
      .length,
    examiner_events: JSON.stringify(
      r.events.filter((e) => e.source === "examiner"),
    ),
    mean_hip_angle: s.meanHipAngle,
    mean_knee_angle: s.meanKneeAngle,
    hip_excursion_shoulder_widths: s.hipExcursion,
    shoulder_excursion_shoulder_widths: s.shoulderExcursion,
    foot_excursion_shoulder_widths: s.footExcursion,
    trunk_range_deg: s.trunkRange,
    valid_frame_ratio: s.validRatio,
    mean_confidence: s.meanConfidence,
    frame_gaps: s.frameGaps,
    normalization: r.normalization,
    notes: r.subject.notes + " " + r.notes,
  };
  return (
    "\uFEFF" +
    Object.keys(row).map(csvCell).join(",") +
    "\r\n" +
    Object.values(row).map(csvCell).join(",") +
    "\r\n"
  );
}
export function download(r: Result, format: "csv" | "json") {
  const blob = new Blob([format === "csv" ? toCSV(r) : toJSON(r)], {
    type: format === "csv" ? "text/csv;charset=utf-8" : "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `assessment-${r.kind}-${r.id}.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
