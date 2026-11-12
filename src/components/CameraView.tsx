import { useEffect, useRef, useState } from "react";
import { useCamera } from "../hooks/useCamera";
import { usePoseLandmarker } from "../hooks/usePoseLandmarker";
import { analyze } from "../utils/biomechanics";
import type { Frame } from "../types/assessment";
const LINKS = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [29, 31],
  [27, 31],
  [28, 30],
  [30, 32],
  [28, 32],
];
export default function CameraView({
  onFrame,
  onStatus,
}: {
  onFrame: (frame: Frame) => void;
  onStatus: (ready: boolean) => void;
}) {
  const camera = useCamera(),
    pose = usePoseLandmarker(!!camera.stream),
    video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const callback = useRef(onFrame);
  callback.current = onFrame;
  const statusCallback = useRef(onStatus);
  statusCallback.current = onStatus;
  const [mirror, setMirror] = useState(true),
    [quality, setQuality] = useState(
      "카메라를 켜고 전신이 보이도록 서 주세요.",
    ),
    [confidence, setConfidence] = useState(0),
    [inferenceError, setInferenceError] = useState("");
  useEffect(() => {
    statusCallback.current(!!camera.stream);
    if (!camera.stream) {
      setConfidence(0);
      setQuality("카메라를 켜고 전신이 보이도록 서 주세요.");
      callback.current(analyze([], performance.now()));
    }
    return () => statusCallback.current(false);
  }, [camera.stream]);
  useEffect(() => {
    setInferenceError("");
    if (video.current) {
      video.current.srcObject = camera.stream;
      if (camera.stream)
        void video.current
          .play()
          .catch(() =>
            setInferenceError("영상 재생 실패. 카메라를 다시 시작하세요."),
          );
    }
  }, [camera.stream]);
  useEffect(() => {
    let raf = 0,
      last = 0,
      lastVideo = -1,
      lastUI = 0,
      failed = false;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const v = video.current,
        c = canvas.current;
      if (!v || !c || !camera.stream || v.readyState < 2) return;
      if (now - last < 83 || v.currentTime === lastVideo) return;
      last = now;
      lastVideo = v.currentTime;
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      if (failed || !pose.model.current) {
        callback.current(analyze([], now));
        return;
      }
      try {
        const result = pose.model.current.detectForVideo(v, now);
        const points = result.landmarks[0] ?? [];
        const frame = analyze(points, now, c.width / c.height);
        callback.current(frame);
        for (const [a, b] of LINKS) {
          const p = points[a],
            q = points[b];
          if (
            !p ||
            !q ||
            (p.visibility ?? 0) < 0.5 ||
            (q.visibility ?? 0) < 0.5
          )
            continue;
          ctx.strokeStyle = a % 2 ? "#47e4cf" : "#ffca76";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(p.x * c.width, p.y * c.height);
          ctx.lineTo(q.x * c.width, q.y * c.height);
          ctx.stroke();
        }
        points.forEach((p, i) => {
          if (i < 11 || (p.visibility ?? 0) < 0.5) return;
          ctx.fillStyle = i % 2 ? "#47e4cf" : "#ffca76";
          ctx.beginPath();
          ctx.arc(p.x * c.width, p.y * c.height, 4, 0, Math.PI * 2);
          ctx.fill();
        });
        if (now - lastUI > 350) {
          lastUI = now;
          setConfidence(frame.confidence);
          setQuality(
            frame.valid
              ? "전신 추적 중 · 좌측 청록 / 우측 주황"
              : points.length
                ? "전신·발이 화면 안에 보이도록 조정하세요. 조명을 확인하세요."
                : "사람을 찾지 못했습니다. 조명과 카메라 거리를 확인하세요.",
          );
        }
      } catch (e) {
        failed = true;
        setConfidence(0);
        setQuality("추론 오류 · 수동 측정 가능");
        setInferenceError("추론 중 오류: " + String(e));
        callback.current(analyze([], now));
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [camera.stream, pose.model, pose.status]);
  return (
    <section className="camera-panel">
      <div className="panel-heading">
        <span>
          <i className={camera.stream ? "live-dot" : "idle-dot"} /> LIVE CAMERA
        </span>
        <span className="badge">
          {camera.stream ? pose.status : "카메라 꺼짐"}
        </span>
      </div>
      <div className="viewfinder">
        <div className={"video-layer " + (mirror ? "mirrored" : "")}>
          <video ref={video} muted playsInline />
          <canvas ref={canvas} />
        </div>
        {!camera.stream && (
          <div className="camera-empty">
            <div className="camera-icon">◎</div>
            <h3>움직임을 관찰할 준비</h3>
            <p>영상은 이 브라우저 안에서만 처리됩니다.</p>
            <button onClick={() => void camera.start()} disabled={camera.busy}>
              {camera.busy ? "연결 중…" : "카메라 연결"}
            </button>
          </div>
        )}
        <span className="view-tag">
          {mirror ? "MIRROR ON" : "MIRROR OFF"} · POSE 33
        </span>
        <span className="corner tl" />
        <span className="corner br" />
      </div>
      <div className="camera-quality">
        <span>{quality}</span>
        <strong>{Math.round(confidence * 100)}%</strong>
      </div>
      <div className="camera-controls">
        <select
          aria-label="웹캠 선택"
          value={camera.device}
          disabled={!!camera.stream || camera.busy}
          onChange={(e) => camera.setDevice(e.target.value)}
        >
          <option value="">기본 카메라</option>
          {camera.devices.map((d, i) => (
            <option key={d.deviceId || i} value={d.deviceId}>
              {d.label || `카메라 ${i + 1}`}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={mirror}
            onChange={(e) => setMirror(e.target.checked)}
          />{" "}
          반전
        </label>
        <button
          className="secondary"
          disabled={camera.busy}
          onClick={() => (camera.stream ? camera.stop() : void camera.start())}
        >
          {camera.stream ? "카메라 종료" : "연결"}
        </button>
      </div>
      {(camera.error || pose.error || inferenceError) && (
        <div className="error" role="alert">
          {camera.error || pose.error || inferenceError}
          <p>수동 측정은 계속 사용할 수 있습니다.</p>
          {pose.error && (
            <button className="secondary" onClick={pose.reload}>
              모델 다시 불러오기
            </button>
          )}
        </div>
      )}
    </section>
  );
}
