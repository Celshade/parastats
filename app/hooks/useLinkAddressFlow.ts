'use client';

import { useCallback, useState } from 'react';
import { buildLinkMessage } from '@/app/utils/addressLinks';
import { signWithWallet } from '@/app/utils/wallet';
import type { ManualSignRequest } from '@/app/components/modals/ManualSignModal';

interface PendingLink {
  message: string;
  timestamp: number;
  primarySignature: string;
}

/**
 * Drives the two-signature address-linking flow: the connected primary
 * wallet signs a challenge first, then the old address signs the same
 * challenge externally and its signature is submitted to complete the link.
 * @param {string} primaryAddress - The connected address to link to.
 * @param {() => void} onLinked - Called after a successful link.
 * @param {() => void} onClose - Called to close the modal after linking.
 */
export function useLinkAddressFlow(
  primaryAddress: string,
  onLinked: () => void,
  onClose: () => void
) {
  const [oldAddress, setOldAddress] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualRequest, setManualRequest] = useState<ManualSignRequest | null>(
    null
  );
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);

  const reset = useCallback(() => {
    setOldAddress('');
    setIsSigning(false);
    setError(null);
    setManualRequest(null);
    setPendingLink(null);
  }, []);

  // Sign with the connected primary wallet (BIP322), then hand off to the
  // old address for its own signature via ManualSignModal.
  const startLink = useCallback(
    async (trimmedAddress: string) => {
      setIsSigning(true);
      setError(null);

      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const message = buildLinkMessage(
          primaryAddress,
          trimmedAddress,
          timestamp
        );
        const primarySignature = await signWithWallet(primaryAddress, message);

        setPendingLink({ message, timestamp, primarySignature });
        setManualRequest({ message, address: trimmedAddress });
      } catch (err) {
        console.error('Link signing error:', err);
        setError(err instanceof Error ? err.message : 'Failed to sign message');
      } finally {
        setIsSigning(false);
      }
    },
    [primaryAddress]
  );

  const submitManualSignature = useCallback(
    async (trimmedAddress: string, linkedSignature: string) => {
      if (!pendingLink) return;

      setManualRequest(null);
      setIsSigning(true);
      setError(null);

      try {
        const response = await fetch('/api/account/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            primary_address: primaryAddress,
            linked_address: trimmedAddress,
            timestamp: pendingLink.timestamp,
            primary_signature: pendingLink.primarySignature,
            linked_signature: linkedSignature,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to link address');
        }

        onLinked();
        onClose();
      } catch (err) {
        console.error('Link submit error:', err);
        setError(err instanceof Error ? err.message : 'Failed to link address');
      } finally {
        setIsSigning(false);
        setPendingLink(null);
      }
    },
    [pendingLink, primaryAddress, onLinked, onClose]
  );

  const cancelManualSign = useCallback(() => {
    setManualRequest(null);
    setPendingLink(null);
  }, []);

  return {
    oldAddress,
    setOldAddress,
    isSigning,
    error,
    setError,
    manualRequest,
    reset,
    startLink,
    submitManualSignature,
    cancelManualSign,
  };
}
