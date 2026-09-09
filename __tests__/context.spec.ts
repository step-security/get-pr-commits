import { describe, expect, it } from "vitest";
import {
  type WorkflowContext,
  resolvePullRequestSource,
} from "../src/context.js";

const REPOSITORY = { owner: { login: "acme" }, name: "widgets" };

function contextFor(
  eventName: string,
  payload: WorkflowContext["payload"] = {},
): WorkflowContext {
  return { eventName, payload };
}

describe("resolvePullRequestSource", () => {
  it("resolves the pull request from a pull_request payload", () => {
    const source = resolvePullRequestSource(
      contextFor("pull_request", {
        repository: REPOSITORY,
        pull_request: { number: 42 },
      }),
    );

    expect(source).toEqual({
      kind: "pull-request",
      ref: { owner: "acme", repo: "widgets", pullNumber: 42 },
    });
  });

  it("takes the repository from the payload, not the environment", () => {
    // A run dispatched against one repository can carry a payload for
    // another; the pull request in the payload is the one to read.
    const source = resolvePullRequestSource(
      contextFor("pull_request", {
        repository: { owner: { login: "other" }, name: "elsewhere" },
        pull_request: { number: 7 },
      }),
    );

    expect(source).toMatchObject({
      ref: { owner: "other", repo: "elsewhere", pullNumber: 7 },
    });
  });

  it("reports an unsupported event without throwing", () => {
    for (const eventName of ["push", "schedule", "workflow_dispatch"]) {
      expect(resolvePullRequestSource(contextFor(eventName))).toEqual({
        kind: "unsupported-event",
        eventName,
      });
    }
  });

  it("reports the event as unsupported before looking at the payload", () => {
    // A push payload has a repository but no pull request. It must be
    // classified by event, not fail on the missing pull request.
    const source = resolvePullRequestSource(
      contextFor("push", { repository: REPOSITORY }),
    );

    expect(source.kind).toBe("unsupported-event");
  });

  it("throws when a supported event carries no pull request", () => {
    // The merge_group case: accepted as an event name, but its payload has no
    // pull request, so a merge queue run cannot be served.
    expect(() =>
      resolvePullRequestSource(
        contextFor("merge_group", { repository: REPOSITORY }),
      ),
    ).toThrow(
      "The merge_group event payload carries no pull request to read commits from",
    );
  });

  it("throws when the payload carries no repository", () => {
    expect(() =>
      resolvePullRequestSource(
        contextFor("pull_request", { pull_request: { number: 42 } }),
      ),
    ).toThrow(
      "The pull_request event payload carries no pull request to read commits from",
    );
  });

  it("throws on an empty payload for a supported event", () => {
    expect(() =>
      resolvePullRequestSource(contextFor("pull_request")),
    ).toThrow();
  });
});