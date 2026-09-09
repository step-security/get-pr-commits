import * as core from "@actions/core";
import * as github from "@actions/github";
import { collectCommits } from "./collect.js";
import { resolvePullRequestSource } from "./context.js";
import { readInputs } from "./inputs.js";
import { validateSubscription } from "./subscription.js";

/**
 * Publishes the commits of the pull request this run belongs to.
 *
 * The commits are emitted as a JSON array on the `commits` output, in the
 * shape the GitHub API returns them, so downstream steps can read any field of
 * each commit rather than a summary chosen here.
 *
 * Every failure lands in one place and fails the step with the underlying
 * message. The one exception is a run that belongs to no pull request, which
 * is not a failure at all.
 */
export async function run(): Promise<void> {
  try {
    await validateSubscription();

    const source = resolvePullRequestSource(github.context);

    if (source.kind === "unsupported-event") {
      // Logged, but not a failure. This lets a workflow attach the step to a
      // broad trigger and have it go quiet on the events that carry no pull
      // request. The output is left unset, so a consumer sees an empty string
      // rather than an empty array and can tell the two apart.
      core.error(`Invalid event: ${source.eventName}`);
      return;
    }

    const { token, filterOutPattern, filterOutFlags } = readInputs();

    const commits = await collectCommits(github.getOctokit(token), source.ref, {
      pattern: filterOutPattern,
      flags: filterOutFlags,
    });

    core.setOutput("commits", JSON.stringify(commits));
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}