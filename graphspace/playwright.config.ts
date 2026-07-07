import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.SPECSPACE_E2E_PORT ?? 5175);
const baseURL = process.env.SPECSPACE_E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
const traceMode = process.env.SPECSPACE_E2E_TRACE === "on" ? "on" : "retain-on-failure";
const videoMode = process.env.SPECSPACE_E2E_VIDEO === "on" ? "on" : "off";
const outputDir = process.env.SPECSPACE_E2E_OUTPUT_DIR ?? "test-results";
const headless = process.env.SPECSPACE_E2E_HEADLESS === "0" ? false : undefined;

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
