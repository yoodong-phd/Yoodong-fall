import { useEffect, useState } from "react";
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export default function PWAControls() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null),
    [installed, setInstalled] = useState(
      () =>
        window.matchMedia("(display-mode: standalone)").matches ||
        !!(navigator as Navigator & { standalone?: boolean }).standalone,
    ),
    [registration, setRegistration] =
      useState<ServiceWorkerRegistration | null>(null),
    [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const install = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    const network = () => setOnline(navigator.onLine);
    window.addEventListener("beforeinstallprompt", install);
    window.addEventListener("appinstalled", done);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    let active = true;
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          const check = () => {
            if (active && reg.waiting) setRegistration(reg);
          };
          check();
          reg.addEventListener("updatefound", () =>
            reg.installing?.addEventListener("statechange", check),
          );
        })
        .catch(() => {
          /* Installation is optional; the web assessment remains available. */
        });
    }
    return () => {
      active = false;
      window.removeEventListener("beforeinstallprompt", install);
      window.removeEventListener("appinstalled", done);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
    };
  }, []);
  const install = async () => {
    if (!prompt) return;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } finally {
      setPrompt(null);
    }
  };
  const update = () => {
    if (
      !registration?.waiting ||
      !window.confirm(
        "업데이트하면 앱이 새로고침됩니다. 측정 중인 검사와 다운로드하지 않은 결과가 사라집니다. 결과를 먼저 내보냈다면 계속할까요?",
      )
    )
      return;
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => window.location.reload(),
      { once: true },
    );
    registration.waiting.postMessage("ACTIVATE_UPDATE");
  };
  return (
    <section className="pwa-panel" aria-label="앱 설치 및 연결 상태">
      <div>
        <strong>
          {installed ? "✓ STABLE 앱 모드" : "STABLE을 홈 화면에서 사용하세요"}
        </strong>
        <p>
          {online
            ? "iOS · Android 설치 지원"
            : "오프라인 · 앱 화면과 수동 측정 사용 가능. AI 모델은 인터넷 연결이 필요할 수 있습니다."}
        </p>
      </div>
      {!installed &&
        (prompt ? (
          <button className="secondary" onClick={() => void install()}>
            앱 설치
          </button>
        ) : (
          <details>
            <summary>설치 방법</summary>
            <p>
              <b>iPhone / iPad:</b> Safari에서 열기 → 공유 → 홈 화면에 추가 →
              추가.
            </p>
            <p>
              <b>Android:</b> Chrome 메뉴 → 앱 설치 또는 홈 화면에 추가. 설치
              항목이 없다면 페이지를 다시 방문해 주세요.
            </p>
            <p>
              설치 후에도 결과는 탭/앱 메모리에만 있으며, 앱 종료 전
              CSV/JSON으로 내보내야 합니다. 최초 접속과 AI 모델 다운로드에는
              인터넷이 필요합니다.
            </p>
          </details>
        ))}
      {registration && (
        <button className="secondary" onClick={update}>
          새 버전 적용
        </button>
      )}
    </section>
  );
}
