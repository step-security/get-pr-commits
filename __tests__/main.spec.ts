import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const core = {
  info: vi.fn(),
  error: vi.fn(),
  setFailed: vi.fn(),
  setOutput: vi.fn(),
};

const octokit = { rest: { pulls: { listCommits: vi.fn() } } };
const getOctokit = vi.fn(() => octokit);

const context: { eventName: string; payload: Record<string, unknown> } = {
  eventName: "pull_request",
  payload: {},
};

const readInputs = vi.fn();
const collectCommits = vi.fn();
const validateSubscription = vi.fn<() => Promise<void>>();

vi.mock("@actions/core", () => core);
vi.mock("@actions/github", () => ({ getOctokit, context }));
vi.mock("../src/inputs.js", () => ({ readInputs }));
vi.mock("../src/collect.js", () => ({ collectCommits }));
vi.mock("../src/subscription.js", () => ({ validateSubscription }));

const { run } = await import("../src/main.js");

const PULL_REQUEST_PAYLOAD = {
  repository: { owner: { login: "acme" }, name: "widgets" },
  pull_request: { number: 42 },
};

function commit(message: string) {
  return { commit: { message } };
}

beforeEach(() => {
  context.eventName = "pull_request";
  context.payload = { ...PULL_REQUEST_PAYLOAD };
  validateSubscription.mockResolvedValue(undefined);
  readInputs.mockReturnValue({
    token: "gh-token",
    filterOutPattern: "",
    filterOutFlags: "",
  });
  collectCommits.mockResolvedValue([commit("feat: one")]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("run", () => {
  it("publishes the collected commits as a JSON array", async () => {
    const commits = [commit("feat: one"), commit("fix: two")];
    collectCommits.mockResolvedValue(commits);

    await run();

    expect(core.setOutput).toHaveBeenCalledWith(
      "commits",
      JSON.stringify(commits),
    );
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it("collects from the pull request the payload names", async () => {
    await run();

    expect(collectCommits).toHaveBeenCalledWith(
      octokit,
      { owner: "acme", repo: "widgets", pullNumber: 42 },
      { pattern: "", flags: "" },
    );
  });

  it("passes the filter inputs through to the collector", async () => {
    readInputs.mockReturnValue({
      token: "gh-token",
      filterOutPattern: "^fixup!",
      filterOutFlags: "i",
    });

    await run();

    expect(collectCommits.mock.calls[0]![2]).toEqual({
      pattern: "^fixup!",
      flags: "i",
    });
  });

  it("authenticates with the token input", async () => {
    await run();

    expect(getOctokit).toHaveBeenCalledWith("gh-token");
  });

  it("checks entitlement before reading anything", async () => {
    const order: string[] = [];
    validateSubscription.mockImplementation(async () => {
      order.push("subscription");
    });
    collectCommits.mockImplementation(async () => {
      order.push("collect");
      return [];
    });

    await run();

    expect(order).toEqual(["subscription", "collect"]);
  });

  it("publishes an empty array when everything was filtered out", async () => {
    collectCommits.mockResolvedValue([]);

    await run();

    expect(core.setOutput).toHaveBeenCalledWith("commits", "[]");
  });

  describe("on an event with no pull request", () => {
    beforeEach(() => {
      context.eventName = "push";
    });

    it("logs an error but does not fail the step", async () => {
      await run();

      expect(core.error).toHaveBeenCalledWith("Invalid event: push");
      expect(core.setFailed).not.toHaveBeenCalled();
    });

    it("leaves the output unset rather than publishing an empty array", async () => {
      // A consumer reading the output on such a run sees an empty string, not
      // "[]", so it can distinguish "did not run" from "no commits".
      await run();

      expect(core.setOutput).not.toHaveBeenCalled();
    });

    it("reads nothing", async () => {
      await run();

      expect(collectCommits).not.toHaveBeenCalled();
      expect(getOctokit).not.toHaveBeenCalled();
    });

    it("does not even read the inputs", async () => {
      await run();

      expect(readInputs).not.toHaveBeenCalled();
    });
  });

  it("fails when a supported event carries no pull request", async () => {
    // merge_group is accepted as an event but its payload has no pull
    // request, so this is the path a merge queue run takes.
    context.eventName = "merge_group";
    context.payload = { repository: PULL_REQUEST_PAYLOAD.repository };

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      "The merge_group event payload carries no pull request to read commits from",
    );
    expect(collectCommits).not.toHaveBeenCalled();
  });

  it("fails with the message from a failed collection", async () => {
    collectCommits.mockRejectedValue(new Error("Bad credentials"));

    await run();

    expect(core.setFailed).toHaveBeenCalledWith("Bad credentials");
    expect(core.setOutput).not.toHaveBeenCalled();
  });

  it("does not read anything when entitlement fails", async () => {
    validateSubscription.mockRejectedValue(new Error("denied"));

    await run();

    expect(collectCommits).not.toHaveBeenCalled();
    expect(core.setFailed).toHaveBeenCalledWith("denied");
  });

  it("reports a non-Error throw rather than swallowing it", async () => {
    collectCommits.mockRejectedValue("unexpected");

    await run();

    expect(core.setFailed).toHaveBeenCalledWith("unexpected");
  });
});