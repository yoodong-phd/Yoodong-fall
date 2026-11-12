import { mkdir, copyFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
const source = resolve("node_modules/@mediapipe/tasks-vision/wasm");
const target = resolve("public/wasm");
await mkdir(target, { recursive: true });
for (const file of await readdir(source)) {
  if (/\.(wasm|js)$/.test(file))
    await copyFile(resolve(source, file), resolve(target, file));
}
