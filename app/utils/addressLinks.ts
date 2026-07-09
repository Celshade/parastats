/**
 * Challenge messages for linking/unlinking addresses. Shared between the
 * client (which asks wallets to sign them) and the API route (which
 * rebuilds them to verify the signatures), so both sides must produce
 * byte-identical strings.
 */

/**
 * Canonical challenge message signed by BOTH addresses to create a link.
 * The timestamp (unix seconds) bounds replayability; the server rejects
 * stale or future-dated messages.
 */
export function buildLinkMessage(
  primaryAddress: string,
  linkedAddress: string,
  timestamp: number
): string {
  return `Parasite: link ${linkedAddress} to ${primaryAddress} at ${timestamp}`;
}

/** Challenge message signed by the primary address to remove a link. */
export function buildUnlinkMessage(
  primaryAddress: string,
  linkedAddress: string,
  timestamp: number
): string {
  return `Parasite: unlink ${linkedAddress} from ${primaryAddress} at ${timestamp}`;
}
