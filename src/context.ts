import { isSupportedEvent } from "./events.js";

/** Identifies the pull request whose commits are to be read. */
export interface PullRequestRef {
  owner: string;
  repo: string;
  pullNumber: number;
}

/**
 * What the workflow context turned out to describe.
 *
 * A run either belongs to a pull request or it does not, and the two cases are
 * handled very differently: one produces output, the other is a non-failing
 * no-op. Making that a union rather than a nullable value means the caller
 * cannot forget the second case.
 */
export type PullRequestSource =
  | { kind: "pull-request"; ref: PullRequestRef }
  | { kind: "unsupported-event"; eventName: string };

/** The shape of a webhook payload this action can read a pull request from. */
interface PullRequestPayload {
  repository?: { owner: { login: string }; name: string };
  pull_request?: { number: number };
}

export interface WorkflowContext {
  eventName: string;
  payload: PullRequestPayload;
}

/**
 * Works out which pull request, if any, the run belongs to.
 *
 * The identity comes from the webhook payload rather than the environment, so
 * a run always reads the pull request that triggered it even when the workflow
 * was dispatched against a different repository.
 *
 * @throws if the event is one that should carry a pull request but does not.
 * That is a real fault rather than a quiet skip: `merge_group` is accepted as
 * an event name for compatibility, yet its payload has no pull request, so a
 * merge queue run reaches this and fails.
 */
export function resolvePullRequestSource(
  context: WorkflowContext,
): PullRequestSource {
  const { eventName, payload } = context;

  if (!isSupportedEvent(eventName)) {
    return { kind: "unsupported-event", eventName };
  }

  const { repository, pull_request: pullRequest } = payload;

  if (!repository || !pullRequest) {
    throw new Error(
      `The ${eventName} event payload carries no pull request to read commits from`,
    );
  }

  return {
    kind: "pull-request",
    ref: {
      owner: repository.owner.login,
      repo: repository.name,
      pullNumber: pullRequest.number,
    },
  };
}