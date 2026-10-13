import { spawnSync } from "node:child_process";
for (const args of [
  ["scripts/test-owners.mjs"],
  ["scripts/test-otp.mjs"],
  ["scripts/test-mentor.mjs"],
  ["--import", "tsx", "scripts/render-check.tsx"],
]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}
