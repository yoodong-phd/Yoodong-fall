import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(process.env.TEST_BASE_URL || "http://127.0.0.1:4173");
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    return fetch(link.href).then((r) => r.json());
  });
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  assert.deepEqual(
    manifest.icons.map((i) => i.sizes),
    ["192x192", "512x512"],
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise((resolve) =>
      navigator.serviceWorker.addEventListener("controllerchange", resolve, {
        once: true,
      }),
    );
  });
  const assets = await page.evaluate(async () => {
    const cache = await caches.open(
      (await caches.keys()).find((k) => k.startsWith("stable-pwa-")),
    );
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  });
  assert(assets.includes("/index.html"));
  assert(assets.some((p) => p.includes("ResultChart")));
  for (const icon of manifest.icons) {
    const response = await page.request.get(new URL(icon.src, page.url()).href);
    assert.equal(response.status(), 200);
    assert.equal((await response.body()).subarray(1, 4).toString(), "PNG");
  }
  await page.screenshot({ path: "/tmp/stable-pwa-mobile.png", fullPage: true });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: "기능평가 시작하기" }).waitFor();
  await page
    .getByText("오프라인 · 앱 화면과 수동 측정 사용 가능.", { exact: false })
    .waitFor();
  await page.getByRole("button", { name: "보행 평가 시작" }).click();
  await page.getByLabel("익명 대상자 코드").fill("P-OFFLINE");
  await page.getByLabel("연령").fill("70");
  await page.getByLabel("검사자 코드").fill("E1");
  await page.getByRole("button", { name: "검사 환경 준비" }).click();
  await page
    .getByRole("checkbox", { name: "의자·3m 경로·보조기·안전을 확인했습니다." })
    .check();
  await page.getByRole("button", { name: "시작 신호 / TUG 시작" }).click();
  await page.getByRole("button", { name: "다시 앉음 확인 · 완료" }).click();
  await page.getByRole("heading", { name: "평가 결과", exact: true }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PWA manifest, PNG icons, service worker activation, offline reload, offline manual TUG and mobile layout passed.",
  );
} finally {
  await browser.close();
}
