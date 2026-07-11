/**
 * Requests a BIP322 signature for `message` from the wallet controlling
 * `address` (via sats-connect) and unwraps the signature from either of
 * the response shapes the wallet provider may return.
 * @param {string} address - The address that should sign the message.
 * @param {string} message - The message to sign.
 * @returns {Promise<string>} The signature.
 */
export async function signWithWallet(
  address: string,
  message: string
): Promise<string> {
  const { request, MessageSigningProtocols } = await import(
    '@sats-connect/core'
  );

  const signResponse = await request('signMessage', {
    address,
    message,
    protocol: MessageSigningProtocols.BIP322,
  });

  if (signResponse.status !== 'success') {
    throw new Error('Failed to sign message');
  }

  if (typeof signResponse.result === 'string') {
    return signResponse.result;
  }

  if (
    signResponse.result &&
    typeof signResponse.result === 'object' &&
    'signature' in signResponse.result
  ) {
    return signResponse.result.signature;
  }

  throw new Error('Unexpected signature format');
}
