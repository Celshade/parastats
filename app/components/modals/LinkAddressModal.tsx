'use client';

import { useEffect, useState } from 'react';
import { isValidBitcoinAddress } from '@/app/utils/validators';
import { buildLinkMessage } from '@/app/utils/addressLinks';
import ManualSignModal, {
  ManualSignRequest,
} from '@/app/components/modals/ManualSignModal';

interface LinkAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  // The connected (Xverse) address the old address gets linked to
  primaryAddress: string;
  onLinked: () => void;
}

/**
 * Links an old mining address to the connected primary address. Both
 * addresses sign the same timestamped challenge: the primary through
 * Xverse, the old address externally (Sparrow/hardware wallet) with the
 * signature pasted into ManualSignModal.
 */
export default function LinkAddressModal({
  isOpen,
  onClose,
  primaryAddress,
  onLinked,
}: LinkAddressModalProps) {
  const [oldAddress, setOldAddress] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualRequest, setManualRequest] = useState<ManualSignRequest | null>(
    null
  );
  const [pendingLink, setPendingLink] = useState<{
    message: string;
    timestamp: number;
    primarySignature: string;
  } | null>(null);

  // Reset state when the modal closes
  useEffect(() => {
    if (!isOpen) {
      setOldAddress('');
      setIsSigning(false);
      setError(null);
      setManualRequest(null);
      setPendingLink(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscKey);
    }

    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const trimmedAddress = oldAddress.trim();

  const handleStartLink = async () => {
    if (!isValidBitcoinAddress(trimmedAddress)) {
      setError('Enter a valid Bitcoin address');
      return;
    }

    if (trimmedAddress === primaryAddress) {
      setError('Cannot link an address to itself');
      return;
    }

    setIsSigning(true);
    setError(null);

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const message = buildLinkMessage(
        primaryAddress,
        trimmedAddress,
        timestamp
      );

      // Sign with the connected primary wallet first (BIP322 via Xverse)
      const { request, MessageSigningProtocols } = await import(
        '@sats-connect/core'
      );

      const signResponse = await request('signMessage', {
        address: primaryAddress,
        message,
        protocol: MessageSigningProtocols.BIP322,
      });

      if (signResponse.status !== 'success') {
        throw new Error('Failed to sign message');
      }

      let primarySignature: string;
      if (typeof signResponse.result === 'string') {
        primarySignature = signResponse.result;
      } else if (
        signResponse.result &&
        typeof signResponse.result === 'object' &&
        'signature' in signResponse.result
      ) {
        primarySignature = signResponse.result.signature;
      } else {
        throw new Error('Unexpected signature format');
      }

      // Now collect the old address's signature via manual paste
      setPendingLink({ message, timestamp, primarySignature });
      setManualRequest({ message, address: trimmedAddress });
    } catch (err) {
      console.error('Link signing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign message');
    } finally {
      setIsSigning(false);
    }
  };

  const handleManualSignature = async (linkedSignature: string) => {
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
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={handleBackdropClick}
      >
        <div
          className="bg-background border border-foreground p-4 sm:p-6 max-w-md w-full mx-4 shadow-xl relative"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex justify-between items-start gap-4 mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-accent-3">
              Link an Address
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
              aria-label="Close modal"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-secondary border border-border p-3 text-sm text-foreground/80 space-y-1">
              <p>
                Link an old mining address to this one. Its stats (best
                difficulty, rounds, loyalty) will count toward this address,
                including any rigs still mining to it.
              </p>
              <p className="text-xs text-foreground/60">
                You&apos;ll sign a challenge with this wallet, then sign the
                same challenge with the wallet that owns the old address.
                Stratum configs and pool payouts to the old address are not
                changed by linking.
              </p>
            </div>

            <div>
              <label
                className="block text-sm font-medium text-accent-2 mb-2"
                htmlFor="link-address-input"
              >
                Old Bitcoin address
              </label>
              <input
                id="link-address-input"
                value={oldAddress}
                onChange={(event) => setOldAddress(event.target.value)}
                placeholder="bc1q..."
                autoFocus
                disabled={isSigning}
                className="w-full bg-secondary text-foreground px-3 py-2 border border-border focus:outline-none focus:border-accent-3 font-mono text-sm disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-500/10 p-3 border border-red-500/20">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                disabled={isSigning}
                className="px-4 py-2 border border-border hover:bg-secondary-hover text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleStartLink}
                disabled={isSigning || !trimmedAddress}
                className="px-4 py-2 bg-foreground text-background hover:bg-foreground/80 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSigning ? 'Signing...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ManualSignModal
        request={manualRequest}
        onSubmit={handleManualSignature}
        onCancel={() => {
          setManualRequest(null);
          setPendingLink(null);
        }}
      />
    </>
  );
}
