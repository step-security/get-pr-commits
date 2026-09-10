[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# get-pr-commits

Reads the commits of the pull request a workflow is running on and publishes
them as JSON, so later steps can inspect them without a checkout.

The usual reason to want this is checking commit messages: conventional commit
prefixes, a required ticket reference, a DCO sign-off, or no leftover `fixup!`
commits.

This is a StepSecurity maintained action: a secure drop-in replacement for
`tim-actions/get-pr-commits`, with the same inputs, the same output, and the
same behaviour.

## Usage

```yaml
name: Sanity check

on: [pull_request]

permissions:
  contents: read
  pull-requests: read

jobs:
  commits:
    runs-on: ubuntu-latest
    steps:
      - id: get-pr-commits
        uses: step-security/get-pr-commits@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Reject leftover fixup commits
        run: |
          echo '${{ steps.get-pr-commits.outputs.commits }}' \
            | jq -e 'map(select(.commit.message | startswith("fixup!"))) | length == 0'
```

Ignore commits you do not want checked, for example a bot's:

```yaml
      - id: get-pr-commits
        uses: step-security/get-pr-commits@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          filter_out_pattern: '^chore\(deps\)'
          filter_out_flags: i
```

## Inputs

| Name                 | Required | Default | Description                                              |
| -------------------- | -------- | ------- | -------------------------------------------------------- |
| `token`              | yes      |         | Token used to read the pull request                      |
| `filter_out_pattern` | no       | `""`    | Commits whose message matches this regex are dropped     |
| `filter_out_flags`   | no       | `''`    | Flags applied to `filter_out_pattern`, for example `i`   |

## Output

| Name      | Description                                                       |
| --------- | ----------------------------------------------------------------- |
| `commits` | JSON array of commits, in the shape the GitHub API returns them   |

Each element carries the full API object, so `.sha`, `.commit.message`,
`.commit.author`, and `.author` are all available. The array is ordered oldest
first, as the API returns it.

## Events

Runs on `pull_request` and `merge_group`. On any other event it logs
`Invalid event: <name>` and **succeeds without setting the output**, so a step
reading `outputs.commits` gets an empty string rather than `[]`. That is
deliberate, so a consumer can tell "did not run" from "no commits".

On `merge_group` the run fails: that event's payload carries no pull request to
read commits from. It is accepted as an event name for compatibility with the
action this replaces, which behaves the same way.

## Two behaviours worth knowing

Both are inherited deliberately, so that swapping this action in changes
nothing. Neither is what you would choose from scratch.

**At most 30 commits.** The commits are fetched in a single unpaginated
request, and the API returns 30 per page, so a pull request with more than 30
commits yields only the first 30. If you gate merges on this, a long pull
request is checked only in part.

**Do not pass `g` in `filter_out_flags`.** A global regex keeps its position
between tests, and one regex instance is applied across the whole list, so
matches alternate: given four commits that all match, two are dropped and two
survive. The result depends on commit order. Use `i` or no flags.

## Permissions

`pull-requests: read` is enough on a public repository. A private repository
also needs `contents: read`. The default `GITHUB_TOKEN` works; pass a PAT only
if you need to read a pull request in another repository.

## Licence

MIT. See [LICENSE](LICENSE).
