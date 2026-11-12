import { useCallback, useEffect, useRef, useState } from "react";
export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
export function useCamera() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [device, setDevice] = useState(""),
    [stream, setStream] = useState<MediaStream | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const active = useRef<MediaStream | null>(null),
    generation = useRef(0);
  const refresh = useCallback(async () => {
    if (navigator.mediaDevices)
      try {
        setDevices(
          (await navigator.mediaDevices.enumerateDevices()).filter(
            (d) => d.kind === "videoinput",
          ),
        );
      } catch {
        setError("카메라 목록을 읽을 수 없습니다.");
      }
  }, []);
  const stop = useCallback(() => {
    generation.current++;
    stopStream(active.current);
    active.current = null;
    setStream(null);
    setBusy(false);
  }, []);
  const start = useCallback(async () => {
    const gen = ++generation.current;
    stopStream(active.current);
    active.current = null;
    setStream(null);
    setBusy(true);
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "HTTPS 또는 localhost 환경에서 카메라를 사용할 수 있습니다.",
        );
      const next = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: device ? { exact: device } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (gen !== generation.current) {
        stopStream(next);
        return;
      }
      active.current = next;
      setStream(next);
      await refresh();
    } catch (e) {
      if (gen === generation.current)
        setError(
          e instanceof Error ? e.message : "카메라 권한 및 연결을 확인하세요.",
        );
    } finally {
      if (gen === generation.current) setBusy(false);
    }
  }, [device, refresh]);
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
      stopStream(active.current);
    };
  }, [refresh]);
  return { devices, device, setDevice, stream, error, busy, start, stop };
}
