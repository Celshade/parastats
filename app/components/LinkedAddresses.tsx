'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAddressLinks } from '@/app/hooks/useAddressLinks';
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
  const { links, unlinking, error, unlink, refetch } = useAddressLinks(userId);
  const [showLinkModal, setShowLinkModal] = useState(false);

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
                onClick={() => unlink(linked)}
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
        onLinked={refetch}
      />
    </div>
  );
}
