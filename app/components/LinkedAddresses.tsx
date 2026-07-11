'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { buildUnlinkMessage } from '@/app/utils/addressLinks';
import type { AddressLinksResponse } from '@/app/api/account/types';
import LinkAddressModal from '@/app/components/modals/LinkAddressModal';


/**
 * Props for the LinkedAddresses component.
 * @property {string} userId - The user ID (address) for which to display linked addresses.
 * @property {boolean} isOwner - Whether the current viewer is the owner of the address.
 * @property {string} [className] - Optional additional CSS classes for styling.
 */
interface LinkedAddressesProps {
  userId: string;
  isOwner: boolean;
  className?: string;
}


/**
 * Linked (alias) addresses for a user page. Everyone sees the "linked
 * to" banner when the page's address is an alias; the owner additionally
 * gets a panel to create and remove links.
 * @param {LinkedAddressesProps} props - The props object.
 * @returns {JSX.Element | null} The rendered LinkedAddresses component.
 */
export default function LinkedAddresses({
  userId,
  isOwner,
  className = '',
}: LinkedAddressesProps) {
  const [links, setLinks] = useState<AddressLinksResponse | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/account/links?address=${encodeURIComponent(userId)}`
      );
      if (response.ok) {
        setLinks(await response.json());
      }
    } catch (err) {
      console.error('Failed to fetch address links:', err);
    }
  }, [userId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleUnlink = async (linkedAddress: string) => {
    setUnlinking(linkedAddress);
    setError(null);

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const message = buildUnlinkMessage(userId, linkedAddress, timestamp);

      const { request, MessageSigningProtocols } = await import(
        '@sats-connect/core'
      );

      const signResponse = await request('signMessage', {
        address: userId,
        message,
        protocol: MessageSigningProtocols.BIP322,
      });

      if (signResponse.status !== 'success') {
        throw new Error('Failed to sign message');
      }

      let signature: string;
      if (typeof signResponse.result === 'string') {
        signature = signResponse.result;
      } else if (
        signResponse.result &&
        typeof signResponse.result === 'object' &&
        'signature' in signResponse.result
      ) {
        signature = signResponse.result.signature;
      } else {
        throw new Error('Unexpected signature format');
      }

      const response = await fetch('/api/account/links', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_address: userId,
          linked_address: linkedAddress,
          timestamp,
          signature,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to unlink address');
      }

      setLinks(data);
    } catch (err) {
      console.error('Unlink error:', err);
      setError(err instanceof Error ? err.message : 'Failed to unlink');
    } finally {
      setUnlinking(null);
    }
  };

  // This page's address is an alias of another primary: show the banner
  // (all viewers), no management panel
  if (links?.linked_to) {
    return (
      <div
        className={`bg-secondary border border-border p-3 text-sm text-foreground/80 ${className}`}
      >
        This address is linked to{' '}
        <Link
          href={`/user/${links.linked_to}`}
          className="font-mono text-accent-3 hover:underline break-all"
        >
          {links.linked_to}
        </Link>
        {' '}&mdash; combined stats are shown there.
      </div>
    );
  }

  if (!isOwner) return null;

  const linkedAddresses = links?.linked_addresses ?? [];

  return (
    <div
      className={`bg-background p-4 shadow-md border border-border ${className}`}
    >
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-accent-2 uppercase">
          Linked Addresses
        </h3>
        <button
          onClick={() => setShowLinkModal(true)}
          className="px-3 py-1 bg-foreground text-background hover:bg-foreground/80 transition-colors text-xs font-medium"
        >
          Link an address
        </button>
      </div>

      {linkedAddresses.length === 0 ? (
        <p className="text-xs text-foreground/60">
          No linked addresses. Link an old mining address to combine its
          stats with this one.
        </p>
      ) : (
        <ul className="space-y-2">
          {linkedAddresses.map((linked) => (
            <li
              key={linked}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="font-mono break-all">{linked}</span>
              <button
                onClick={() => handleUnlink(linked)}
                disabled={unlinking !== null}
                className="px-2 py-1 border border-border hover:bg-secondary-hover transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {unlinking === linked ? 'Unlinking...' : 'Unlink'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="mt-3 text-sm text-red-500 bg-red-500/10 p-2 border border-red-500/20">
          {error}
        </div>
      )}

      <LinkAddressModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        primaryAddress={userId}
        onLinked={fetchLinks}
      />
    </div>
  );
}
