export type Point = { x: number; y: number; z?: number; visibility?: number };
export type TugState =
  | "READY"
  | "SIT_TO_STAND"
  | "WALK_OUT"
  | "TURN"
  | "WALK_BACK"
  | "STAND_TO_SIT"
  | "COMPLETED";
export type Subject = {
  code: string;
  age: string;
  sex: string;
  date: string;
  examiner: string;
  aid: string;
  notes: string;
};
export type Frame = {
  t: number;
  confidence: number;
  valid: boolean;
  hipX: number | null;
  hipY: number | null;
  shoulderX: number | null;
  trunk: number | null;
  hipAngle: number | null;
  kneeAngle: number | null;
  footX: number | null;
  shoulderWidth: number | null;
  landmarks: Point[];
};
export type Event = {
  t: number;
  state: string;
  source: "examiner" | "automatic";
  note: string;
};
export type BalanceStage = {
  stage: number;
  seconds: number;
  passed: boolean;
  reason: string;
  events: Event[];
  frames: Frame[];
};
export type Result = {
  id: string;
  subject: Subject;
  kind: "balance" | "tug";
  completed: boolean;
  seconds: number;
  stages: BalanceStage[];
  events: Event[];
  frames: Frame[];
  notes: string;
  normalization: string;
  endedAt: string;
};
