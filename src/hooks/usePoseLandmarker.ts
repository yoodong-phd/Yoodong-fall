import { useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
export function usePoseLandmarker(enabled: boolean) {
  const model = useRef<PoseLandmarker | null>(null),
    [status, setStatus] = useState("대기"),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let instance: PoseLandmarker | null = null;
    setStatus("모델 로딩");
    setError("");
    (async () => {
      try {
        const { FilesetResolver, PoseLandmarker } = await import(
          "@mediapipe/tasks-vision"
        );
        if (cancelled) return;
        const files = await FilesetResolver.forVisionTasks("/wasm");
        instance = await PoseLandmarker.createFromOptions(files, {
          baseOptions: {
            modelAssetPath:
              import.meta.env.VITE_POSE_MODEL_URL ||
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        if (cancelled) {
          instance.close();
          return;
        }
        model.current = instance;
        setStatus("추적 준비");
      } catch (e) {
        if (!cancelled) {
          setStatus("모델 오류");
          setError(
            "모델 다운로드 또는 초기화 실패: " +
              (e instanceof Error ? e.message : String(e)),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      if (model.current === instance) model.current = null;
      instance?.close();
    };
  }, [enabled, retry]);
  return { model, status, error, reload: () => setRetry((x) => x + 1) };
}
