import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--use-fake-device-for-media-stream"],
});
const denied = await browser.newPage();
await denied.context().grantPermissions([]);
await denied.goto(process.env.TEST_BASE_URL || "http://localhost:5173");
await denied.getByRole("button", { name: "균형 평가 시작" }).click();
await denied.getByLabel("익명 대상자 코드").fill("P-ERROR");
await denied.getByLabel("연령").fill("70");
await denied.getByLabel("검사자 코드").fill("E1");
await denied.getByRole("button", { name: "검사 환경 준비" }).click();
await denied.getByRole("button", { name: "카메라 연결", exact: true }).click();
await denied.getByRole("alert").waitFor({ timeout: 15000 });
console.log("Camera permission denial displays an actionable alert.");
await denied.close();
const ctx = await browser.newContext({ permissions: ["camera"] });
const page = await ctx.newPage();
await page.route("https://storage.googleapis.com/**", (r) => r.abort("failed"));
await page.goto(process.env.TEST_BASE_URL || "http://localhost:5173");
await page.getByRole("button", { name: "보행 평가 시작" }).click();
await page.getByLabel("익명 대상자 코드").fill("P-ERROR");
await page.getByLabel("연령").fill("70");
await page.getByLabel("검사자 코드").fill("E1");
await page.getByRole("button", { name: "검사 환경 준비" }).click();
await page.getByRole("button", { name: "카메라 연결", exact: true }).click();
await page
  .getByRole("button", { name: "모델 다시 불러오기" })
  .waitFor({ timeout: 30000 });
await page
  .getByRole("checkbox", { name: "의자·3m 경로·보조기·안전을 확인했습니다." })
  .check();
await page.getByRole("button", { name: "시작 신호 / TUG 시작" }).click();
await page.getByRole("button", { name: "다시 앉음 확인 · 완료" }).click();
await page.getByRole("heading", { name: "평가 결과", exact: true }).waitFor();
console.log("Model fetch failure displays retry; manual TUG remains usable.");
await browser.close();
