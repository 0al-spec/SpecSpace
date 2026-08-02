import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.SPECSPACE_E2E_PORT ?? 5175);
const baseURL = process.env.SPECSPACE_E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
const traceMode =
  process.env.SPECSPACE_E2E_TRACE === "off"
    ? "off"
    : process.env.SPECSPACE_E2E_TRACE === "on"
      ? "on"
      : "retain-on-failure";
const videoMode = process.env.SPECSPACE_E2E_VIDEO === "on" ? "on" : "off";
const outputDir = process.env.SPECSPACE_E2E_OUTPUT_DIR ?? "test-results";
const headless = process.env.SPECSPACE_E2E_HEADLESS === "0" ? false : undefined;
const operatorUsername = process.env.SPECSPACE_E2E_OPERATOR_USERNAME;
const operatorPassword = process.env.SPECSPACE_E2E_OPERATOR_PASSWORD;

if (Boolean(operatorUsername) !== Boolean(operatorPassword)) {
  throw new Error(
    "SPECSPACE_E2E_OPERATOR_USERNAME and SPECSPACE_E2E_OPERATOR_PASSWORD must be configured together.",
  );
}
if (operatorPassword && (traceMode !== "off" || videoMode !== "off")) {
  throw new Error(
    "Authenticated E2E runs require SPECSPACE_E2E_TRACE=off and SPECSPACE_E2E_VIDEO=off.",
  );
}

export default defineConfig({
  testDir: "./e2e",
  outputDir,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: traceMode,
    video: videoMode,
    ...(operatorUsername && operatorPassword
      ? { httpCredentials: { username: operatorUsername, password: operatorPassword } }
      : {}),
    ...(headless === undefined ? {} : { headless }),
  },
  webServer: process.env.SPECSPACE_E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
