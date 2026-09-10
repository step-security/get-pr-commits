import * as core from "@actions/core";

export interface Inputs {
  token: string;
  /** Regex matched against each commit message; matching commits are dropped. Empty disables filtering. */
  filterOutPattern: string;
  /** Flags applied to `filterOutPattern`. */
  filterOutFlags: string;
}

/**
 * Reads the action inputs.
 *
 * `token` is declared required in `action.yml`, but that is not enforced by the
 * runner and is not enforced here either. An empty token produces an
 * unauthenticated client, which is exactly what the action this replaces did,
 * and on a public repository it can still succeed.
 */
export function readInputs(): Inputs {
  return {
    token: core.getInput("token"),
    filterOutPattern: core.getInput("filter_out_pattern"),
    filterOutFlags: core.getInput("filter_out_flags"),
  };
}
