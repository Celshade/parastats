'use client';

import { useCallback, useEffect, useState } from 'react';
import { buildUnlinkMessage } from '@/app/utils/addressLinks';
import { signWithWallet } from '@/app/utils/wallet';
import type { AddressLinksResponse } from '@/app/api/account/types';

/**
 * Fetches a user's address links and provides an unlink action that signs
 * a timestamped challenge with the connected wallet before submitting.
 * @param {string} userId - The address whose links are managed.
 */
export function useAddressLinks(userId: string) {
  const [links, setLinks] = useState<AddressLinksResponse | null>(null);
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

  const unlink = useCallback(
    async (linkedAddress: string) => {
      setUnlinking(linkedAddress);
      setError(null);

      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const message = buildUnlinkMessage(userId, linkedAddress, timestamp);
        const signature = await signWithWallet(userId, message);

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
    },
    [userId]
  );

  return { links, unlinking, error, unlink, refetch: fetchLinks };
}
