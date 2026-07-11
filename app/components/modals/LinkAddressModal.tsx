'use client';

import { useEffect } from 'react';
import { isValidBitcoinAddress } from '@/app/utils/validators';
import ManualSignModal from '@/app/components/modals/ManualSignModal';
import { useLinkAddressFlow } from '@/app/hooks/useLinkAddressFlow';

/**
 * Props for the LinkAddressModal component.
 * @property {boolean} isOpen - Whether the modal is open.
 * @property {() => void} onClose - Callback function to close the modal.
 * @property {string} primaryAddress - The connected (Xverse) address the old address gets linked to.
 * @property {() => void} onLinked - Callback function to call after a successful link.
 */
interface LinkAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  primaryAddress: string;
  onLinked: () => void;
}

/**
 * Links an old mining address to the connected primary address. Both
 * addresses sign the same timestamped challenge: the primary through
 * Xverse, the old address externally (Sparrow/hardware wallet) with the
 * signature pasted into ManualSignModal.
 * @param {LinkAddressModalProps} props - The props object.
 * @returns {JSX.Element | null} The rendered LinkAddressModal component or null if not open.
 */
export default function LinkAddressModal({
  isOpen,
  onClose,
  primaryAddress,
  onLinked,
}: LinkAddressModalProps) {
  const {
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
  } = useLinkAddressFlow(primaryAddress, onLinked, onClose);

  // Reset state when the modal closes
  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

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

  const handleStartLink = () => {
    if (!isValidBitcoinAddress(trimmedAddress)) {
      setError('Enter a valid Bitcoin address');
      return;
    }

    if (trimmedAddress === primaryAddress) {
      setError('Cannot link an address to itself');
      return;
    }

    startLink(trimmedAddress);
  };

  const handleManualSignature = (linkedSignature: string) => {
    submitManualSignature(trimmedAddress, linkedSignature);
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
        onCancel={cancelManualSign}
      />
    </>
  );
}
