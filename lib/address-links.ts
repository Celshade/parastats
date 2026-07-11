import { getDb } from '@/lib/db';

/**
 * Helpers for the address_links table: a "linked" (old) address acts as
 * a live alias of its "primary" address. Stats endpoints aggregate over
 * resolveAddressSet(); links are single-level (no chains).
 *
 * The challenge-message builders shared with the client live in
 * app/utils/addressLinks.ts (this module is server-only).
 * @param {string} primaryAddress - The primary address to look up linked addresses for.
 * @returns An array of addresses linked to the primary address, in order of link time.
 */
export function getLinkedAddresses(primaryAddress: string): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT linked_address FROM address_links
       WHERE primary_address = ?
       ORDER BY linked_at ASC`
    )
    .all(primaryAddress) as { linked_address: string }[];
  return rows.map((row) => row.linked_address);
}


/**
 * The address itself plus every address linked to it.
 * @param {string} address - The address to resolve.
 * @returns {string[]} An array containing the address itself and all linked addresses.
 */
export function resolveAddressSet(address: string): string[] {
  return [address, ...getLinkedAddresses(address)];
}


/** Reverse lookup: the primary this address is linked to, if any.
 * @param {string} address - The address to look up the primary for.
 * @returns {string | null} The primary address if it exists, otherwise null.
 */
export function getPrimaryFor(address: string): string | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT primary_address FROM address_links WHERE linked_address = ?`
    )
    .get(address) as { primary_address: string } | undefined;
  return row?.primary_address ?? null;
}

/** SQL placeholder list ("?, ?, ?") sized to an address set. */
export function placeholders(set: string[]): string {
  return set.map(() => '?').join(', ');
}
