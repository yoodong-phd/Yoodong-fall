import PWAControls from "./components/PWAControls";
import { screeningMessage } from "./services/screening";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import CameraView from "./components/CameraView";
const ResultChart = lazy(() => import("./components/ResultChart"));
import {
  STANCES,
  STANCE_EN,
  INSTRUCTIONS,
  finishStage,
  canAdvance,
  elapsedSeconds,
} from "./services/balanceAnalysis";
import {
  TUG_STATES,
  TUG_LABELS,
  nextState,
  proposeTransition,
  segments,
} from "./services/tugAnalysis";
import { summarize } from "./utils/biomechanics";
import { download } from "./services/exportResults";
import type {
  Subject,
  Result,
  Frame,
  Event,
  BalanceStage,
  TugState,
} from "./types/assessment";
type Page = "dashboard" | "subject" | "balance" | "tug" | "results";
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const fmt = (n: number | null | undefined, d = 2) =>
  n == null ? "—" : n.toFixed(d);
const NORMALIZATION =
  "영상 종횡비로 x좌표 보정; 첫 유효 프레임의 어깨너비로 화면상 변위 범위를 정규화. 실제 거리·COP·COM이 아님.";
export default function App() {
  const [page, setPage] = useState<Page>("dashboard"),
    [subject, setSubject] = useState<Subject>({
      code: "",
      age: "",
      sex: "",
      date: today(),
      examiner: "",
      aid: "없음",
      notes: "",
    }),
    [results, setResults] = useState<Result[]>([]),
    [camera, setCamera] = useState(false),
    [destination, setDestination] = useState<"balance" | "tug">("balance");
  const begin = (kind: "balance" | "tug") => {
    if (
      (page === "balance" || page === "tug") &&
      !window.confirm(
        "검사 화면을 나가면 저장하지 않은 측정이 사라집니다. 이동할까요?",
      )
    )
      return;
    setDestination(kind);
    setPage("subject");
  };
  const navigate = (target: Page) => {
    if (
      (page === "balance" || page === "tug") &&
      !window.confirm(
        "검사 화면을 나가면 저장하지 않은 측정이 사라집니다. 이동할까요?",
      )
    )
      return;
    setPage(target);
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("dashboard");
          }}
        >
          <span className="brand-mark">
            S<span>↗</span>
          </span>
          <div>
            STABLE<small>HUMAN MOVEMENT LAB</small>
          </div>
        </a>
        <div className="workspace-label">ASSESSMENT WORKSPACE</div>
        <nav>
          {(
            [
              ["dashboard", "◫", "대시보드"],
              ["subject", "♙", "대상자 정보"],
              ["balance", "⚖", "균형 기능평가"],
              ["tug", "↗", "보행 기능평가"],
              ["results", "▥", "평가 결과"],
            ] as const
          ).map(([key, icon, label]) => (
            <button
              key={key}
              className={page === key ? "nav-item active" : "nav-item"}
              onClick={() =>
                key === "balance" || key === "tug" ? begin(key) : navigate(key)
              }
            >
              <span>{icon}</span>
              {label}
              {page === key && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="research-icon">✧</div>
          <strong>연구를 위한 움직임 분석</strong>
          <p>
            브라우저 내 AI 분석
            <br />
            영상 업로드 및 기본 저장 없음
          </p>
          <span className="badge">RESEARCH PROTOTYPE</span>
        </div>
        <div className="lab-user">
          <div className="avatar">HM</div>
          <div>
            Human Movement Lab<small>연구·교육용 워크스페이스</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            워크스페이스 <b>/</b>{" "}
            {
              {
                dashboard: "대시보드",
                subject: "대상자 정보",
                balance: "4-Stage Balance Test",
                tug: "Timed Up and Go",
                results: "평가 결과",
              }[page]
            }
          </span>
          <div>
            <span className="status-pill">
              <i className={camera ? "live-dot" : "idle-dot"} />
              {camera ? "카메라 연결됨" : "카메라 대기"}
            </span>
            <span className="date-label">{today()}</span>
          </div>
        </header>
        <main>
          {page === "dashboard" && (
            <>
              <div className="page-title">
                <div>
                  <div className="eyebrow">AI FALL ASSESSMENT SYSTEM</div>
                  <h1>
                    움직임을 이해하는,
                    <br />더 나은 기능평가.
                  </h1>
                  <p>
                    실시간 관절 추적으로 균형과 보행을 관찰하고, 객관적인 평가
                    기록을 만드세요.
                  </p>
                </div>
                <div className="title-badge">
                  <span>✧</span> AI 기반 동작 분석
                  <small>MediaPipe Pose Landmarker</small>
                </div>
              </div>
              <div className="overview-grid">
                <div className="overview-card">
                  <span>평가 프로토콜</span>
                  <strong>
                    02 <small>검사</small>
                  </strong>
                  <p>CDC STEADI 참고 절차</p>
                </div>
                <div className="overview-card">
                  <span>현재 세션 기록</span>
                  <strong>
                    {String(results.length).padStart(2, "0")} <small>건</small>
                  </strong>
                  <p>다운로드 전 브라우저 메모리에 보관</p>
                </div>
                <div className="overview-card privacy">
                  <span>개인정보 보호</span>
                  <strong>
                    Local <small>processing</small>
                  </strong>
                  <p>원본 영상 전송·저장 없음</p>
                </div>
              </div>
              <div className="section-title">
                <div>
                  <h2>기능평가 시작하기</h2>
                  <p>목적에 맞는 검사를 선택하고 촬영 환경을 준비하세요.</p>
                </div>
                <span className="muted">STANDARDIZED PROTOCOLS</span>
              </div>
              <div className="assessment-grid">
                <article className="assessment-card">
                  <div className="card-top">
                    <span className="test-icon">⚖</span>
                    <span className="badge teal">BALANCE</span>
                  </div>
                  <div className="stance-art" aria-hidden="true">
                    <span>
                      ●<br />
                      ╱│╲
                      <br />╱ ╲
                    </span>
                    <span>
                      ●<br />
                      ╱│╲
                      <br /> ││
                    </span>
                    <span>
                      ●<br />
                      ╱│╲
                      <br /> │
                    </span>
                    <span>
                      ●<br />
                      ╱│╲
                      <br />
                      ╱┘
                    </span>
                    <div className="art-floor" />
                  </div>
                  <div className="card-content">
                    <span className="eyebrow">01 / 정적 균형 능력</span>
                    <h2>4-Stage Balance Test</h2>
                    <p>
                      4가지 자세에서 균형 유지시간과
                      <br />
                      화면상 신체 흔들림을 관찰합니다.
                    </p>
                    <div className="test-tags">
                      <span>정면 촬영</span>
                      <span>단계별 10초</span>
                      <span>검사자 자세 확인</span>
                    </div>
                    <button onClick={() => begin("balance")}>
                      균형 평가 시작 <span>↗</span>
                    </button>
                  </div>
                </article>
                <article className="assessment-card">
                  <div className="card-top">
                    <span className="test-icon navy">↗</span>
                    <span className="badge">MOBILITY</span>
                  </div>
                  <div className="walk-art" aria-hidden="true">
                    <span className="chair">▤</span>
                    <span className="walker">
                      ●<br />
                      ╱│╲
                      <br />╱ ╲
                    </span>
                    <span className="walk-path">
                      ····················↶<small>바닥에 실제 3 m 표시</small>
                    </span>
                  </div>
                  <div className="card-content">
                    <span className="eyebrow">02 / 이동 및 보행 기능</span>
                    <h2>Timed Up and Go</h2>
                    <p>
                      일어서기부터 보행, 방향 전환, 앉기까지
                      <br />
                      수행시간과 동작 변화를 기록합니다.
                    </p>
                    <div className="test-tags">
                      <span>측면·대각선 촬영</span>
                      <span>실제 3m 경로</span>
                      <span>수동 측정 지원</span>
                    </div>
                    <button
                      className="navy-button"
                      onClick={() => begin("tug")}
                    >
                      보행 평가 시작 <span>↗</span>
                    </button>
                  </div>
                </article>
              </div>
              <section className="preparation">
                <div>
                  <span className="step-number">✓</span>
                  <div>
                    <h3>검사 전, 함께 확인하세요</h3>
                    <p>안전을 확보하고 동일한 조건에서 측정합니다.</p>
                  </div>
                </div>
                <ol>
                  <li>주변 장애물 제거 및 검사자 근접 보호</li>
                  <li>전신과 발이 보이는 안정된 카메라 위치</li>
                  <li>대상자 코드 입력 및 검사 절차 안내</li>
                </ol>
              </section>
              <div className="notice">
                <span>ⓘ</span>
                <p>
                  <strong>연구·교육용 프로토타입입니다.</strong> 운동학 지표는
                  탐색 변수이며 임상 검증된 낙상위험 예측이나 진단 결과가
                  아닙니다. 실제 고령자 검사는 훈련된 검사자의 안전 관리 아래
                  진행하세요.
                </p>
              </div>
            </>
          )}
          {page === "subject" && (
            <>
              <Title
                eyebrow="PARTICIPANT"
                title="대상자 정보"
                description="익명 코드만 사용하세요. 이름·연락처·주민등록번호는 입력하지 않습니다."
              />
              <form
                className="panel subject-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(destination);
                }}
              >
                <div className="form-grid">
                  <label>
                    익명 대상자 코드 *
                    <input
                      required
                      maxLength={40}
                      pattern="[A-Za-z0-9_-]+"
                      placeholder="예: P-001"
                      value={subject.code}
                      onChange={(e) =>
                        setSubject({ ...subject, code: e.target.value })
                      }
                    />
                    <small>영문·숫자·하이픈·밑줄만 사용</small>
                  </label>
                  <label>
                    연령 *
                    <input
                      type="number"
                      min="18"
                      max="120"
                      required
                      value={subject.age}
                      onChange={(e) =>
                        setSubject({ ...subject, age: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    성별 (선택)
                    <select
                      value={subject.sex}
                      onChange={(e) =>
                        setSubject({ ...subject, sex: e.target.value })
                      }
                    >
                      <option value="">미입력</option>
                      <option>여성</option>
                      <option>남성</option>
                      <option>응답하지 않음</option>
                    </select>
                  </label>
                  <label>
                    검사 날짜 *
                    <input
                      type="date"
                      required
                      value={subject.date}
                      onChange={(e) =>
                        setSubject({ ...subject, date: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    검사자 코드 *
                    <input
                      required
                      maxLength={40}
                      value={subject.examiner}
                      onChange={(e) =>
                        setSubject({ ...subject, examiner: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    보조기 사용
                    <select
                      value={subject.aid}
                      onChange={(e) =>
                        setSubject({ ...subject, aid: e.target.value })
                      }
                    >
                      <option>없음</option>
                      <option>지팡이</option>
                      <option>보행기</option>
                      <option>기타</option>
                    </select>
                  </label>
                  <label className="full-width">
                    메모
                    <textarea
                      maxLength={2000}
                      placeholder="검사 조건, 보조기, 관찰 사항 (개인 식별 정보 제외)"
                      value={subject.notes}
                      onChange={(e) =>
                        setSubject({ ...subject, notes: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="form-footer">
                  <label>
                    선택한 검사
                    <select
                      value={destination}
                      onChange={(e) =>
                        setDestination(e.target.value as "balance" | "tug")
                      }
                    >
                      <option value="balance">4-Stage Balance Test</option>
                      <option value="tug">Timed Up and Go</option>
                    </select>
                  </label>
                  <button type="submit">검사 환경 준비 →</button>
                </div>
              </form>
            </>
          )}
          {(page === "balance" || page === "tug") && (
            <Assessment
              key={page}
              kind={page}
              subject={subject}
              onStatus={setCamera}
              onSave={(r) => {
                setResults((x) => [r, ...x]);
                setPage("results");
              }}
            />
          )}
          {page === "results" && (
            <Results
              results={results}
              onChange={setResults}
              onStart={() => setPage("dashboard")}
            />
          )}
          <PWAControls />
          <footer>
            STABLE <span>AI Fall Assessment System</span>
            <small>Research & Education · 영상 기반 탐색 분석</small>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Title({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-title compact">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
function Assessment({
  kind,
  subject,
  onSave,
  onStatus,
}: {
  kind: "balance" | "tug";
  subject: Subject;
  onSave: (r: Result) => void;
  onStatus: (v: boolean) => void;
}) {
  const [running, setRunning] = useState(false),
    [seconds, setSeconds] = useState(0),
    [stage, setStage] = useState(0),
    [stages, setStages] = useState<BalanceStage[]>([]),
    [confirmed, setConfirmed] = useState(false),
    [state, setState] = useState<TugState>("READY"),
    [proposal, setProposal] = useState<TugState | null>(null),
    [notes, setNotes] = useState(""),
    [live, setLive] = useState<Frame | null>(null),
    [notice, setNotice] = useState("");
  const started = useRef<number | null>(null),
    frames = useRef<Frame[]>([]),
    events = useRef<Event[]>([]),
    currentState = useRef<TugState>("READY"),
    lastUI = useRef(0),
    proposed = useRef(new Set<string>()),
    lastValid = useRef(0),
    segmentStart = useRef(0);
  const makeResult = (
    duration: number,
    complete: boolean,
    allStages: BalanceStage[] = stages,
  ): Result => ({
    id: crypto.randomUUID(),
    subject: { ...subject },
    kind,
    completed: complete,
    seconds: duration,
    stages: allStages,
    frames:
      kind === "balance"
        ? allStages.flatMap((s, i) =>
            s.frames.map((f) => ({
              ...f,
              t:
                f.t +
                allStages.slice(0, i).reduce((a, b) => a + b.seconds * 1000, 0),
            })),
          )
        : [...frames.current],
    events:
      kind === "balance"
        ? allStages.flatMap((s, i) =>
            s.events.map((e) => ({
              ...e,
              t:
                e.t +
                allStages.slice(0, i).reduce((a, b) => a + b.seconds * 1000, 0),
            })),
          )
        : [...events.current],
    notes,
    normalization: NORMALIZATION,
    endedAt: new Date().toISOString(),
  });
  const finishBalance = (reason: string, now = performance.now()) => {
    if (started.current === null) return;
    const origin = started.current;
    started.current = null;
    const s = finishStage(stage, origin, now, reason);
    s.frames = frames.current.filter((f) => f.t <= s.seconds * 1000);
    s.events = [
      ...events.current,
      {
        t: s.seconds * 1000,
        state: STANCES[stage],
        source: "examiner",
        note: reason,
      },
    ];
    setSeconds(s.seconds);
    setRunning(false);
    setConfirmed(false);
    const all = [...stages, s];
    setStages(all);
    if (!canAdvance(s)) {
      onSave(
        makeResult(
          all.reduce((a, b) => a + b.seconds, 0),
          all.length === 4 && all.every((x) => x.passed),
          all,
        ),
      );
    } else {
      setStage(stage + 1);
      setNotice("앞 단계를 완료했습니다. 다음 자세를 확인하고 시작하세요.");
    }
  };
  const finishTug = (complete: boolean, reason: string) => {
    if (started.current === null) return;
    const t = performance.now() - started.current;
    events.current.push({
      t,
      state: complete ? "COMPLETED" : "ABORTED",
      source: "examiner",
      note: reason,
    });
    started.current = null;
    setRunning(false);
    onSave(makeResult(t / 1000, complete));
  };
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      if (started.current === null) return;
      const now = performance.now();
      setSeconds(
        elapsedSeconds(
          started.current,
          now,
          kind === "balance" ? 10 : Infinity,
        ),
      );
      if (kind === "balance" && now - started.current >= 10000) {
        finishBalance("목표 달성", started.current + 10000);
        return;
      }
      if (now - lastValid.current > 1200)
        setNotice(
          "추적 데이터가 부족합니다. 타이머는 계속됩니다. 검사자가 자세·안전을 확인하고 필요하면 중단하세요.",
        );
    }, 50);
    return () => clearInterval(timer);
  });
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (started.current !== null) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const start = () => {
    if (
      started.current !== null ||
      !confirmed ||
      !subject.code ||
      !subject.examiner
    )
      return;
    const now = performance.now();
    started.current = now;
    frames.current = [];
    events.current = [];
    proposed.current.clear();
    lastValid.current = now;
    segmentStart.current = 0;
    setNotice("");
    setSeconds(0);
    setProposal(null);
    setRunning(true);
    if (kind === "tug") {
      currentState.current = "SIT_TO_STAND";
      setState("SIT_TO_STAND");
      events.current.push({
        t: 0,
        state: "SIT_TO_STAND",
        source: "examiner",
        note: "검사자의 시작 신호",
      });
    } else
      events.current.push({
        t: 0,
        state: STANCES[stage],
        source: "examiner",
        note: "검사자 자세 확인 후 시작",
      });
  };
  const move = (target: TugState, note: string) => {
    if (
      started.current === null ||
      target === "READY" ||
      target === "COMPLETED"
    )
      return;
    segmentStart.current = performance.now() - started.current;
    events.current.push({
      t: segmentStart.current,
      state: target,
      source: "examiner",
      note,
    });
    currentState.current = target;
    setState(target);
    setProposal(null);
  };
  const onFrame = (frame: Frame) => {
    if (frame.t - lastUI.current > 300) {
      lastUI.current = frame.t;
      setLive(frame);
    }
    if (started.current === null) return;
    const f = { ...frame, t: frame.t - started.current };
    frames.current.push(f);
    if (f.valid) lastValid.current = frame.t;
    if (kind === "balance" && f.valid) {
      const summary = summarize(frames.current);
      if ((summary.hipExcursion ?? 0) > 0.25 && !proposed.current.has("sway")) {
        proposed.current.add("sway");
        events.current.push({
          t: f.t,
          state: "SWAY_FLAG",
          source: "automatic",
          note: "화면 고관절 중심 변위 범위 > 최초 어깨너비 0.25 (탐색 임계값, 균형 상실 판정 아님)",
        });
        setNotice(
          "화면상 흔들림 신호 감지 (탐색적). 실제 균형 상실 여부는 검사자가 판단하세요.",
        );
      }
    }
    if (kind === "tug") {
      const target = proposeTransition(
        currentState.current,
        frames.current.filter((f) => f.t >= segmentStart.current),
      );
      if (target && !proposed.current.has(target)) {
        proposed.current.add(target);
        setProposal(target);
        events.current.push({
          t: f.t,
          state: target,
          source: "automatic",
          note: "탐색적 자동 후보. 검사자 확인 시점과 별도 기록.",
        });
      }
    }
  };
  const reset = () => {
    if (!window.confirm("현재 검사 기록을 지우고 처음부터 재검사할까요?"))
      return;
    started.current = null;
    frames.current = [];
    events.current = [];
    currentState.current = "READY";
    proposed.current.clear();
    setRunning(false);
    setSeconds(0);
    setStage(0);
    setStages([]);
    setState("READY");
    setProposal(null);
    setConfirmed(false);
    setNotice("");
  };
  return (
    <>
      <Title
        eyebrow={
          kind === "balance"
            ? "01 / BALANCE ASSESSMENT"
            : "02 / MOBILITY ASSESSMENT"
        }
        title={kind === "balance" ? "4-Stage Balance Test" : "Timed Up and Go"}
        description={`${subject.code || "대상자 코드 미입력"} · ${kind === "balance" ? "정면 촬영 / 전신과 발을 포함하세요." : "측면·대각선 촬영 / 바닥에 실제 3m를 표시하세요."}`}
      />
      {(!subject.code || !subject.examiner) && (
        <div className="error">
          대상자 정보에서 익명 대상자 코드와 검사자 코드를 먼저 입력하세요.
        </div>
      )}
      <div className="test-layout">
        <div>
          <CameraView onFrame={onFrame} onStatus={onStatus} />
          <div className="metrics">
            <Metric
              label="고관절 각도"
              value={fmt(live?.hipAngle, 1)}
              unit="°"
            />
            <Metric
              label="무릎 각도"
              value={fmt(live?.kneeAngle, 1)}
              unit="°"
            />
            <Metric label="체간 기울기" value={fmt(live?.trunk, 1)} unit="°" />
          </div>
          <div className="notice">
            <span>ⓘ</span>
            <p>
              {kind === "balance"
                ? "발 앞뒤 위치는 정면 영상만으로 확정할 수 없습니다. 검사자가 직접 자세를 확인하세요. 외부 지지 또는 10초 유지 실패 시 다음 단계로 진행하지 않습니다."
                : "표준 시간은 검사자의 시작 신호부터 다시 앉는 시점까지입니다. 자동 후보는 타이머를 변경하지 않습니다. 인식 실패 시 수동으로 완료하세요."}
            </p>
          </div>
        </div>
        <div className="test-controller panel">
          <div className="eyebrow">
            {kind === "balance"
              ? `STAGE ${stage + 1} OF 4`
              : "EXAMINER CONTROL"}
          </div>
          <h2>{kind === "balance" ? STANCES[stage] : TUG_LABELS[state]}</h2>
          <p>
            {kind === "balance"
              ? INSTRUCTIONS[stage]
              : "시작을 누르며 “시작” 신호를 주세요. 대상자가 다시 앉으면 완료를 누르세요."}
          </p>
          <div className="timer">
            <strong>{seconds.toFixed(2)}</strong>
            <span>초 {kind === "balance" && "/ 10.00"}</span>
          </div>
          {kind === "balance" ? (
            <div className="stage-list">
              {STANCES.map((s, i) => (
                <div key={s} className={i === stage ? "current" : ""}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    {s}
                    <small>{STANCE_EN[i]}</small>
                  </div>
                  <b>
                    {stages.find((x) => x.stage === i)
                      ? "10.00 s"
                      : i === stage
                        ? "진행 단계"
                        : "대기"}
                  </b>
                </div>
              ))}
            </div>
          ) : (
            <div className="tug-steps">
              {TUG_STATES.map((s) => (
                <span key={s} className={state === s ? "selected" : ""}>
                  {TUG_LABELS[s]}
                </span>
              ))}
            </div>
          )}
          {!running && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              {kind === "balance"
                ? "검사자가 실제 자세와 안전을 확인했습니다."
                : "의자·3m 경로·보조기·안전을 확인했습니다."}
            </label>
          )}
          {!running ? (
            <button
              className="wide"
              onClick={start}
              disabled={!confirmed || !subject.code || !subject.examiner}
            >
              {kind === "balance"
                ? `${stage + 1}단계 측정 시작`
                : "시작 신호 / TUG 시작"}
            </button>
          ) : (
            <div className="button-stack">
              {kind === "balance" ? (
                <>
                  <button
                    className="danger"
                    onClick={() => finishBalance("검사자 균형 상실 판정")}
                  >
                    균형 상실 · 검사 종료
                  </button>
                  <button
                    className="secondary"
                    onClick={() => finishBalance("외부 지지 필요")}
                  >
                    외부 지지 필요 · 종료
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => finishTug(true, "검사자가 다시 앉음을 확인")}
                  >
                    다시 앉음 확인 · 완료
                  </button>
                  {state !== "STAND_TO_SIT" && (
                    <button
                      className="secondary"
                      onClick={() =>
                        move(nextState(state), "검사자가 구간 전환 확인")
                      }
                    >
                      다음 구간 확인 → {TUG_LABELS[nextState(state)]}
                    </button>
                  )}
                  <label>
                    수동 구간 보정
                    <select
                      value={state}
                      onChange={(e) =>
                        move(
                          e.target.value as TugState,
                          "검사자가 진행 구간을 수동 보정",
                        )
                      }
                    >
                      <option disabled value="READY">
                        준비
                      </option>
                      {TUG_STATES.slice(1, -1).map((s) => (
                        <option key={s} value={s}>
                          {TUG_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <button
                className="danger subtle"
                onClick={() =>
                  kind === "balance"
                    ? finishBalance("검사자 중단")
                    : finishTug(false, "검사자 중단")
                }
              >
                검사 중단
              </button>
            </div>
          )}
          {proposal && running && (
            <div className="proposal">
              <strong>자동 후보: {TUG_LABELS[proposal]}</strong>
              <p>검사자 확인 필요 · 정밀 검증 전 탐색적 감지</p>
              <button
                className="secondary"
                onClick={() =>
                  proposal === "COMPLETED"
                    ? finishTug(true, "자동 앉기 후보를 검사자가 확인")
                    : move(proposal, "자동 후보를 검사자가 확인")
                }
              >
                현재 시점에 확인
              </button>
              <button className="text-button" onClick={() => setProposal(null)}>
                무시
              </button>
            </div>
          )}
          {notice && (
            <div className="warning" role="status">
              {notice}
            </div>
          )}
          <label className="notes-label">
            검사 중 특이사항
            <textarea
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="검사자 관찰 내용을 기록하세요."
            />
          </label>
          <button className="text-button wide" onClick={reset}>
            ↺ 처음부터 재검사
          </button>
          <small className="muted">
            추적 실패 시 시간은 정지하지 않습니다. 카메라 중지 또는 화면 이탈은
            자동으로 임상적 실패로 판정하지 않습니다.
          </small>
        </div>
      </div>
    </>
  );
}
function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
    </div>
  );
}
function Results({
  results,
  onChange,
  onStart,
}: {
  results: Result[];
  onChange: (r: Result[]) => void;
  onStart: () => void;
}) {
  const [index, setIndex] = useState(0),
    [correction, setCorrection] = useState(""),
    [reason, setReason] = useState("");
  const r = results[Math.min(index, results.length - 1)];
  if (!r)
    return (
      <>
        <Title
          eyebrow="RESULTS"
          title="평가 결과"
          description="측정을 완료하면 이곳에서 시간과 운동학 지표를 확인할 수 있습니다."
        />
        <div className="empty-state">
          <h2>아직 측정 기록이 없습니다.</h2>
          <p>임의의 데이터 없이 실제 검사 기록만 표시합니다.</p>
          <button onClick={onStart}>검사 선택하기</button>
        </div>
      </>
    );
  const summary = summarize(r.frames),
    screening = screeningMessage(r);
  return (
    <>
      <Title
        eyebrow="ASSESSMENT REPORT"
        title="평가 결과"
        description={`${r.subject.code} · ${r.subject.date} · ${r.kind === "balance" ? "4-Stage Balance Test" : "Timed Up and Go"}`}
      />
      <div className="result-toolbar">
        <select
          aria-label="결과 선택"
          value={index}
          onChange={(e) => {
            setIndex(+e.target.value);
            setCorrection("");
            setReason("");
          }}
        >
          {results.map((x, i) => (
            <option key={x.id} value={i}>
              {x.subject.code} · {x.kind.toUpperCase()} ·{" "}
              {new Date(x.endedAt).toLocaleTimeString()}
            </option>
          ))}
        </select>
        <div>
          <button className="secondary" onClick={() => download(r, "csv")}>
            ↓ CSV
          </button>
          <button onClick={() => download(r, "json")}>↓ JSON + 궤적</button>
        </div>
      </div>
      <div className="metrics result-metrics">
        <Metric
          label="검사 상태"
          value={r.completed ? "완료" : "중단 / 미완료"}
        />
        <Metric
          label={r.kind === "tug" ? "TUG 전체 시간" : "측정 유지시간 합계"}
          value={fmt(r.seconds)}
          unit="초"
        />
        <Metric
          label="유효 추적 프레임"
          value={
            summary.validRatio === null ? "—" : fmt(summary.validRatio * 100, 0)
          }
          unit="%"
        />
        <Metric
          label="자동 감지 후보"
          value={String(
            r.events.filter((e) => e.source === "automatic").length,
          )}
          unit="건"
        />
      </div>
      <div className="notice">
        <span>ⓘ</span>
        <p>
          <strong>{screening}</strong>
          <br />
          참고 선별 기준이며 진단이 아닙니다. AI 위험점수·위험확률은 산출하지
          않습니다.
        </p>
      </div>
      <section className="panel">
        <h2>검사 구간별 기록</h2>
        {r.kind === "balance" ? (
          <div className="stage-results">
            {STANCES.map((name, i) => {
              const s = r.stages.find((x) => x.stage === i);
              return (
                <div key={name}>
                  <span>{name}</span>
                  <strong>{s ? `${fmt(s.seconds)} s` : "미실시"}</strong>
                  <small>{s ? s.reason : "앞 단계 완료 후 진행"}</small>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <p>
              검사자가 구간을 확인한 시점을 기준으로 계산합니다. 구간 미표시 시
              전체 시간이 하나의 구간에 포함될 수 있으며, 실제 동작별
              소요시간으로 해석하지 마세요.
            </p>
            <div className="stage-results">
              {segments(r.events, r.seconds * 1000).map((s, i) => (
                <div key={i}>
                  <span>{TUG_LABELS[s.state as TugState]}</span>
                  <strong>{fmt(s.seconds)} s</strong>
                  <small>검사자 확인 기준</small>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>운동학 탐색 지표</h2>
          <span className="badge teal">EXPLORATORY · 2D</span>
        </div>
        <div className="metrics">
          <Metric
            label="고관절 중심 좌우 변위 범위"
            value={fmt(summary.hipExcursion, 3)}
            unit="어깨너비"
          />
          <Metric
            label="어깨 중심 좌우 변위 범위"
            value={fmt(summary.shoulderExcursion, 3)}
            unit="어깨너비"
          />
          <Metric
            label="발목·발끝 평균점 변위 범위"
            value={fmt(summary.footExcursion, 3)}
            unit="어깨너비"
          />
          <Metric
            label="체간 기울기 범위"
            value={fmt(summary.trunkRange, 1)}
            unit="°"
          />
        </div>
        <p className="muted">
          {r.normalization} 원근·거리·가림의 영향을 받습니다. 발의 평균점은 각
          발의 이동을 상쇄할 수 있으므로 JSON 개별 궤적과 함께 확인하세요.
        </p>
        <Suspense fallback={<div className="empty-state">그래프 로딩 중…</div>}>
          <ResultChart frames={r.frames} />
        </Suspense>
        <p className="muted">
          수집 {summary.frames} 프레임 · 유효 {summary.validFrames} · 평균 최소
          랜드마크 신뢰도{" "}
          {summary.meanConfidence === null
            ? "없음"
            : fmt(summary.meanConfidence * 100, 0) + "%"}{" "}
          · 500ms 이상 프레임 간격 {summary.frameGaps}회
        </p>
      </section>
      <section className="panel">
        <h2>자동 후보 및 검사자 확인 이력</h2>
        <div className="event-table">
          <table>
            <thead>
              <tr>
                <th>시점</th>
                <th>출처</th>
                <th>상태</th>
                <th>기록</th>
              </tr>
            </thead>
            <tbody>
              {r.events.map((e, i) => (
                <tr key={i}>
                  <td>{fmt(e.t / 1000)} s</td>
                  <td>{e.source === "automatic" ? "자동 후보" : "검사자"}</td>
                  <td>{TUG_LABELS[e.state as TugState] || e.state}</td>
                  <td>{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>특이사항: {r.notes || "없음"}</p>
        {r.kind === "tug" && (
          <form
            className="correction-form"
            onSubmit={(e) => {
              e.preventDefault();
              const value = Number(correction);
              if (!Number.isFinite(value) || value <= 0) return;
              const updated = {
                ...r,
                seconds: value,
                events: [
                  ...r.events,
                  {
                    t: r.seconds * 1000,
                    state: "TIME_CORRECTION",
                    source: "examiner" as const,
                    note: `전체 시간 수동 보정: ${r.seconds.toFixed(3)} → ${value.toFixed(3)} s. 사유: ${reason}. 기존 구간·자동 후보 시점은 원본 유지.`,
                  },
                ],
              };
              onChange(results.map((x) => (x.id === r.id ? updated : x)));
              setReason("");
              setCorrection("");
            }}
          >
            <h3>전체 시간 수동 보정</h3>
            <p>
              원본 시점과 구간은 보존되며 총 시간 변경 내역을 기록합니다. 보정
              후 구간 합계와 총 시간이 다를 수 있습니다.
            </p>
            <div className="correction-fields">
              <input
                aria-label="보정 시간 (초)"
                required
                type="number"
                min="0.001"
                step="0.001"
                value={correction}
                onChange={(e) => setCorrection(e.target.value)}
                placeholder="보정 시간 (초)"
              />
              <input
                aria-label="보정 사유"
                required
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
                placeholder="보정 사유"
              />
              <button type="submit">보정 기록</button>
            </div>
          </form>
        )}
      </section>
      <div className="notice">
        <span>↓</span>
        <p>
          결과는 현재 탭의 메모리에만 있습니다. 새로고침·탭 종료 전 CSV 또는
          JSON을 다운로드하세요. JSON에는 프레임별 랜드마크와 타임스탬프가
          포함되며 영상은 포함되지 않습니다.
        </p>
      </div>
      <div className="references">
        프로토콜 참고:{" "}
        <a
          href="https://www.cdc.gov/steadi/media/pdfs/STEADI-Assessment-TUG-508.pdf"
          target="_blank"
          rel="noreferrer"
        >
          CDC STEADI · TUG ↗
        </a>
        <a
          href="https://www.cdc.gov/steadi/media/pdfs/STEADI-Assessment-4Stage-508.pdf"
          target="_blank"
          rel="noreferrer"
        >
          4-Stage Balance ↗
        </a>
      </div>
    </>
  );
}
