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
 * @param {string} primaryAddress - The primary address in the link.
 * @param {string} linkedAddress - The linked address in the link.
 * @param {number} timestamp - The unix timestamp (seconds) of the link request.
 * @returns {string} The canonical challenge message for linking addresses.
 */
export function buildLinkMessage(
  primaryAddress: string,
  linkedAddress: string,
  timestamp: number
): string {
  return `Parasite: link ${linkedAddress} to ${primaryAddress} at ${timestamp}`;
}


/**
 * Challenge message signed by the primary address to remove a link.
 * @param {string} primaryAddress - The primary address in the link.
 * @param {string} linkedAddress - The linked address in the link.
 * @param {number} timestamp - The unix timestamp (seconds) of the unlink request.
 * @returns {string} The canonical challenge message for unlinking addresses.
 */
export function buildUnlinkMessage(
  primaryAddress: string,
  linkedAddress: string,
  timestamp: number
): string {
  return `Parasite: unlink ${linkedAddress} from ${primaryAddress} at ${timestamp}`;
}
