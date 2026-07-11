import { Verifier } from 'bip322-js';

/**
 * Verify a BIP322 message signature for a given address.
 *
 * Wraps bip322-js so malformed signatures/addresses surface as a plain
 * `false` instead of a thrown error, letting API routes treat every
 * failure mode as "invalid signature".
 * @param {string} address - The address to verify the signature against.
 * @param {string} message - The message that was signed.
 * @param {string} signature - The signature to verify.
 * @returns {boolean} `true` if the signature is valid else `false`.
 */
export function verifyBip322Signature(
  address: string,
  message: string,
  signature: string
): boolean {
  try {
    return Verifier.verifySignature(address, message, signature);
  } catch {
    return false;
  }
}
