/**
 * Events this action will read commits for.
 *
 * Anything else is refused, because the commit list is derived from the pull
 * request the run belongs to and there is no pull request to derive it from.
 */
export const SUPPORTED_EVENTS = ["pull_request", "merge_group"] as const;

export function isSupportedEvent(eventName: string): boolean {
  return (SUPPORTED_EVENTS as readonly string[]).includes(eventName);
}
