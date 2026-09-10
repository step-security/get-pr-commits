import { describe, expect, it } from "vitest";
import { SUPPORTED_EVENTS, isSupportedEvent } from "../src/events.js";

describe("isSupportedEvent", () => {
  it("accepts the two events that carry a pull request", () => {
    expect(isSupportedEvent("pull_request")).toBe(true);
    expect(isSupportedEvent("merge_group")).toBe(true);
  });

  it("rejects events with no pull request to read", () => {
    for (const event of ["push", "workflow_dispatch", "schedule", "release"]) {
      expect(isSupportedEvent(event)).toBe(false);
    }
  });

  it("rejects pull_request_target, which the original did not accept either", () => {
    // Worth pinning: it looks like it should work, and adding it would change
    // which workflows this action runs in.
    expect(isSupportedEvent("pull_request_target")).toBe(false);
  });

  it("rejects an empty event name", () => {
    expect(isSupportedEvent("")).toBe(false);
  });

  it("lists exactly the supported events", () => {
    expect([...SUPPORTED_EVENTS]).toEqual(["pull_request", "merge_group"]);
  });
});
