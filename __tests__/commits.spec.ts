import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CommitLister,
  type PullRequestCommit,
  filterOutCommits,
  listPullRequestCommits,
} from "../src/commits.js";

const listCommits = vi.fn();
const client: CommitLister = { rest: { pulls: { listCommits } } };

function commit(message: string, extra: Record<string, unknown> = {}) {
  return { commit: { message }, ...extra } as PullRequestCommit;
}

beforeEach(() => {
  listCommits.mockReset();
  listCommits.mockResolvedValue({ data: [commit("feat: one")] });
});

describe("listPullRequestCommits", () => {
  it("asks for the commits of the given pull request", async () => {
    await listPullRequestCommits(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 42,
    });

    expect(listCommits).toHaveBeenCalledWith({
      owner: "acme",
      repo: "widgets",
      pull_number: 42,
    });
  });

  it("makes a single unpaginated request", async () => {
    // Locks in the 30-commit ceiling of the action this replaces. Paginating
    // would widen the output for every existing caller.
    await listPullRequestCommits(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 42,
    });

    expect(listCommits).toHaveBeenCalledTimes(1);
    expect(listCommits.mock.calls[0]![0]).not.toHaveProperty("per_page");
    expect(listCommits.mock.calls[0]![0]).not.toHaveProperty("page");
  });

  it("returns the commits the API returned, untouched", async () => {
    const data = [commit("a", { sha: "1" }), commit("b", { sha: "2" })];
    listCommits.mockResolvedValue({ data });

    await expect(
      listPullRequestCommits(client, {
        owner: "acme",
        repo: "widgets",
        pullNumber: 1,
      }),
    ).resolves.toEqual(data);
  });

  it("propagates an API rejection", async () => {
    listCommits.mockRejectedValue(new Error("Not Found"));

    await expect(
      listPullRequestCommits(client, {
        owner: "acme",
        repo: "widgets",
        pullNumber: 1,
      }),
    ).rejects.toThrow("Not Found");
  });
});

describe("filterOutCommits", () => {
  const commits = [
    commit("feat: add thing"),
    commit("fixup! feat: add thing"),
    commit("chore: tidy"),
  ];

  it("returns the list untouched when no pattern is given", () => {
    // An empty pattern must not compile to //, which matches everything and
    // would drop every commit.
    expect(filterOutCommits(commits, "", "")).toEqual(commits);
    expect(filterOutCommits(commits, "", "i")).toEqual(commits);
  });

  it("drops commits whose message matches", () => {
    const kept = filterOutCommits(commits, "^fixup!", "");

    expect(kept.map((c) => c.commit.message)).toEqual([
      "feat: add thing",
      "chore: tidy",
    ]);
  });

  it("keeps commits that do not match", () => {
    expect(filterOutCommits(commits, "^nothing-matches-this", "")).toEqual(
      commits,
    );
  });

  it("applies the flags it is given", () => {
    const mixed = [commit("FIXUP! something"), commit("feat: keep")];

    expect(filterOutCommits(mixed, "^fixup!", "").length).toBe(2);
    expect(filterOutCommits(mixed, "^fixup!", "i").length).toBe(1);
  });

  it("matches anywhere in the message unless anchored", () => {
    const multi = [commit("feat: thing\n\nSigned-off-by: someone")];

    expect(filterOutCommits(multi, "Signed-off-by", "")).toEqual([]);
  });

  it("carries regex state across commits when given the g flag", () => {
    // Not a nicety: a global regex advances lastIndex on every test, so
    // matches alternate and the result depends on commit order. This is the
    // behaviour of the action being replaced, and callers passing `g` are
    // already living with it, so it is preserved rather than corrected.
    const all = [
      commit("drop me"),
      commit("drop me"),
      commit("drop me"),
      commit("drop me"),
    ];

    const kept = filterOutCommits(all, "drop me", "g");

    expect(kept.length).toBe(2);
  });

  it("throws on an invalid pattern so the caller can fail the step", () => {
    expect(() => filterOutCommits(commits, "([unclosed", "")).toThrow();
  });

  it("throws on invalid flags", () => {
    expect(() => filterOutCommits(commits, "x", "qq")).toThrow();
  });

  it("does not mutate the list it was given", () => {
    const original = [...commits];
    filterOutCommits(commits, "^fixup!", "");

    expect(commits).toEqual(original);
  });
});
