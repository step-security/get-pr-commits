import { beforeEach, describe, expect, it, vi } from "vitest";

const core = { info: vi.fn() };
vi.mock("@actions/core", () => core);

const { collectCommits } = await import("../src/collect.js");

const listCommits = vi.fn();
const client = { rest: { pulls: { listCommits } } };
const ref = { owner: "acme", repo: "widgets", pullNumber: 42 };

function commit(message: string, sha: string) {
  return { sha, commit: { message } };
}

const THREE = [
  commit("feat: add thing", "a1"),
  commit("fixup! feat: add thing", "a2"),
  commit("chore: tidy", "a3"),
];

beforeEach(() => {
  vi.clearAllMocks();
  listCommits.mockResolvedValue({ data: THREE });
});

describe("collectCommits", () => {
  it("returns the commits unfiltered when no pattern is given", async () => {
    const commits = await collectCommits(client, ref, {
      pattern: "",
      flags: "",
    });

    expect(commits).toEqual(THREE);
  });

  it("returns only the commits the filter kept", async () => {
    const commits = await collectCommits(client, ref, {
      pattern: "^fixup!",
      flags: "",
    });

    expect(commits.map((c) => c.commit.message)).toEqual([
      "feat: add thing",
      "chore: tidy",
    ]);
  });

  it("reads the pull request it was pointed at", async () => {
    await collectCommits(client, ref, { pattern: "", flags: "" });

    expect(listCommits).toHaveBeenCalledWith({
      owner: "acme",
      repo: "widgets",
      pull_number: 42,
    });
  });

  it("reports the count when nothing is filtered", async () => {
    await collectCommits(client, ref, { pattern: "", flags: "" });

    expect(core.info).toHaveBeenCalledWith("Found 3 commits");
  });

  it("reports both counts when a filter is applied", async () => {
    // The point of the log line: a reader can see the pull request had more
    // commits than were published, rather than wondering where they went.
    await collectCommits(client, ref, { pattern: "^fixup!", flags: "" });

    expect(core.info).toHaveBeenCalledWith(
      "Found 3 commits, 2 left after filtering",
    );
  });

  it("reports the filtered form even when the filter removed nothing", async () => {
    await collectCommits(client, ref, { pattern: "matches-nothing", flags: "" });

    expect(core.info).toHaveBeenCalledWith(
      "Found 3 commits, 3 left after filtering",
    );
  });

  it("propagates an API failure rather than reporting a count", async () => {
    listCommits.mockRejectedValue(new Error("Not Found"));

    await expect(
      collectCommits(client, ref, { pattern: "", flags: "" }),
    ).rejects.toThrow("Not Found");
    expect(core.info).not.toHaveBeenCalled();
  });

  it("propagates an invalid pattern rather than reporting a count", async () => {
    await expect(
      collectCommits(client, ref, { pattern: "([unclosed", flags: "" }),
    ).rejects.toThrow();
    expect(core.info).not.toHaveBeenCalled();
  });
});