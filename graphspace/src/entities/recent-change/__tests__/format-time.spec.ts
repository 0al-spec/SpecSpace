import { describe, it, expect } from "vitest";
import { relativeTime } from "../lib/format-time";

const NOW = new Date("2026-05-10T12:00:00Z");

describe("relativeTime", () => {
  it.each([
    ["2026-05-10T11:59:30Z", "now"],
    ["2026-05-10T11:57:00Z", "3m"],
    ["2026-05-10T10:00:00Z", "2h"],
    ["2026-05-08T12:00:00Z", "2d"],
  ])("%s -> %s", (iso, expected) => {
    expect(relativeTime(iso, NOW)).toBe(expected);
  });

  it("falls back to month/day for older dates", () => {
    expect(relativeTime("2026-04-27T10:00:00Z", NOW)).toMatch(/Apr 27/);
  });

  it("returns the raw ISO when the input is not a valid date", () => {
    expect(relativeTime("not-a-date", NOW)).toBe("not-a-date");
  });
});
