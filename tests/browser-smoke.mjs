import { chromium } from "playwright";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  permissions: ["camera"],
  acceptDownloads: true,
});
await page.addInitScript(() => {
  window.__testStreams = [];
  const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (...args) => {
    const s = await get(...args);
    window.__testStreams.push(s);
    return s;
  };
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(process.env.TEST_BASE_URL || "http://localhost:5173");
await page.screenshot({ path: "/tmp/yoodong-dashboard.png", fullPage: true });
await page.getByRole("button", { name: "균형 평가 시작" }).click();
await page.getByLabel("익명 대상자 코드").fill("P-TEST");
await page.getByLabel("연령").fill("72");
await page.getByLabel("검사자 코드").fill("E-TEST");
await page.getByRole("button", { name: "검사 환경 준비" }).click();
await page.getByRole("button", { name: "카메라 연결", exact: true }).click();
await page.getByText("카메라 연결됨", { exact: true }).waitFor();
await page
  .getByRole("checkbox", { name: "검사자가 실제 자세와 안전을 확인했습니다." })
  .check();
await page.getByRole("button", { name: "1단계 측정 시작" }).click();
await page.waitForTimeout(10300);
await page.getByRole("button", { name: "2단계 측정 시작" }).waitFor();
await page
  .getByRole("checkbox", { name: "검사자가 실제 자세와 안전을 확인했습니다." })
  .check();
await page.getByRole("button", { name: "2단계 측정 시작" }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "외부 지지 필요 · 종료" }).click();
await page.getByRole("heading", { name: "평가 결과", exact: true }).waitFor();
const released = await page.evaluate(() =>
  window.__testStreams.every((s) =>
    s.getTracks().every((t) => t.readyState === "ended"),
  ),
);
if (!released) throw new Error("Camera tracks not released on unmount");
if (!(await page.getByText("Tandem 미실시:", { exact: false }).count()))
  throw new Error("Missing unperformed screening");
const downloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: "↓ JSON + 궤적" }).click();
const dl = await downloadPromise;
await dl.saveAs("/tmp/balance-result.json");
const balance = JSON.parse(
  await fs.readFile("/tmp/balance-result.json", "utf8"),
);
if (
  balance.stages.length !== 2 ||
  balance.stages[0].seconds !== 10 ||
  balance.stages[1].passed ||
  balance.completed
)
  throw new Error("Balance stop rule broken");
await page.getByRole("button", { name: "보행 기능평가", exact: false }).click();
await page.getByRole("button", { name: "검사 환경 준비" }).click();
await page
  .getByRole("checkbox", { name: "의자·3m 경로·보조기·안전을 확인했습니다." })
  .check();
await page.getByRole("button", { name: "시작 신호 / TUG 시작" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "다음 구간 확인" }).click();
await page.getByLabel("수동 구간 보정").selectOption("TURN");
await page.waitForTimeout(100);
await page.getByLabel("수동 구간 보정").selectOption("WALK_BACK");
await page.getByRole("button", { name: "다시 앉음 확인 · 완료" }).click();
await page.getByRole("heading", { name: "평가 결과", exact: true }).waitFor();
await page.getByRole("spinbutton", { name: "보정 시간 (초)" }).fill("12.5");
await page
  .getByRole("textbox", { name: "보정 사유" })
  .fill("테스트: 외부 스톱워치와 대조");
await page.getByRole("button", { name: "보정 기록", exact: true }).click();
const dp = page.waitForEvent("download");
await page.getByRole("button", { name: "↓ JSON + 궤적" }).click();
const d = await dp;
await d.saveAs("/tmp/tug-result.json");
const tug = JSON.parse(await fs.readFile("/tmp/tug-result.json", "utf8"));
if (
  tug.seconds !== 12.5 ||
  !tug.events.some((e) => e.state === "TIME_CORRECTION") ||
  !tug.completed
)
  throw new Error("TUG manual completion/correction broken");
const csvPromise = page.waitForEvent("download");
await page.getByRole("button", { name: "↓ CSV", exact: true }).click();
await (await csvPromise).saveAs("/tmp/tug-result.csv");
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "대시보드", exact: false }).click();
await page.screenshot({ path: "/tmp/yoodong-mobile.png", fullPage: true });
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth,
);
if (overflow) throw new Error("Mobile horizontal overflow");
console.log(
  JSON.stringify({
    balanceStages: balance.stages.map((s) => s.seconds),
    tugSeconds: tug.seconds,
    manualEvents: tug.events.length,
    mobileOverflow: overflow,
    cameraReleased: released,
    pageErrors: errors,
  }),
);
if (errors.length) throw new Error("Browser errors");
await browser.close();
