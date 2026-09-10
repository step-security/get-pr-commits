import * as core from "@actions/core";
import {
  type CommitLister,
  type PullRequestCommit,
  filterOutCommits,
  listPullRequestCommits,
} from "./commits.js";
import type { PullRequestRef } from "./context.js";

/** How commits should be excluded from the result. */
export interface CommitFilter {
  pattern: string;
  flags: string;
}

/**
 * Reads a pull request's commits and applies the filter, reporting what it did.
 *
 * The reporting is here rather than in the caller because the counts either
 * side of the filter are only both in scope at this point, and a run that
 * publishes fewer commits than the pull request contains should say so in the
 * log rather than leave the reader to wonder.
 */
export async function collectCommits(
  client: CommitLister,
  ref: PullRequestRef,
  filter: CommitFilter,
): Promise<PullRequestCommit[]> {
  const found = await listPullRequestCommits(client, ref);
  const kept = filterOutCommits(found, filter.pattern, filter.flags);

  core.info(
    filter.pattern
      ? `Found ${found.length} commits, ${kept.length} left after filtering`
      : `Found ${found.length} commits`,
  );

  return kept;
}