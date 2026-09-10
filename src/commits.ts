import type { PullRequestRef } from "./context.js";

/** A commit as the pull request commits endpoint returns it. */
export interface PullRequestCommit {
  commit: { message: string };
  [key: string]: unknown;
}

/**
 * The single API call this action makes.
 *
 * A structural type rather than Octokit's own, so tests can supply a double
 * without standing up a client.
 */
export interface CommitLister {
  rest: {
    pulls: {
      listCommits(params: {
        owner: string;
        repo: string;
        pull_number: number;
      }): Promise<{ data: PullRequestCommit[] }>;
    };
  };
}

/**
 * Fetches the commits of a pull request.
 *
 * Deliberately a single unpaginated request, matching the action this
 * replaces. The endpoint returns 30 commits per page by default, so a pull
 * request with more than that yields only the first 30. Paginating would be an
 * improvement in isolation, but it would also silently widen the result for
 * every existing caller, and callers that feed this into a commit-message
 * check would start failing on commits they have always ignored.
 */
export async function listPullRequestCommits(
  client: CommitLister,
  ref: PullRequestRef,
): Promise<PullRequestCommit[]> {
  const response = await client.rest.pulls.listCommits({
    owner: ref.owner,
    repo: ref.repo,
    pull_number: ref.pullNumber,
  });

  return response.data;
}

/**
 * Drops commits whose message matches the pattern.
 *
 * An empty pattern disables filtering entirely and returns the list untouched;
 * it does not compile to an empty regex, which would match everything and drop
 * every commit.
 *
 * One regex instance is reused across the whole list, which matters when the
 * caller supplies the `g` flag: a global regex carries `lastIndex` between
 * `test` calls, so matches and non-matches alternate. That is the behaviour of
 * the action this replaces, and callers passing `g` today get results that
 * depend on commit order, so it is preserved rather than quietly corrected.
 *
 * @throws {SyntaxError} if the pattern or flags are not valid.
 */
export function filterOutCommits(
  commits: PullRequestCommit[],
  pattern: string,
  flags: string,
): PullRequestCommit[] {
  if (!pattern) {
    return commits;
  }

  const regex = new RegExp(pattern, flags);
  return commits.filter(({ commit }) => !regex.test(commit.message));
}
