import { NextResponse } from 'next/server';
import { isValidBitcoinAddress } from '@/app/utils/validators';
import {
  buildLinkMessage,
  buildUnlinkMessage,
} from '@/app/utils/addressLinks';
import type {
  AddressLinkCreate,
  AddressLinkDelete,
  AddressLinksResponse,
} from '@/app/api/account/types';
import { getDb } from '@/lib/db';
import { getLinkedAddresses, getPrimaryFor } from '@/lib/address-links';
import { verifyBip322Signature } from '@/lib/bip322';

// Signed challenge messages older (or further in the future) than this
// are rejected to bound replayability.
const TIMESTAMP_WINDOW_SECONDS = 10 * 60;

function isTimestampStale(timestamp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - timestamp) > TIMESTAMP_WINDOW_SECONDS;
}

function linksResponse(address: string): AddressLinksResponse {
  return {
    primary_address: address,
    linked_addresses: getLinkedAddresses(address),
    linked_to: getPrimaryFor(address),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address || !isValidBitcoinAddress(address)) {
      return NextResponse.json(
        { error: 'Valid address query parameter is required' },
        { status: 400 }
      );
    }

    return NextResponse.json(linksResponse(address));
  } catch (error) {
    console.error('Error fetching address links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch address links' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    let payload: Partial<AddressLinkCreate>;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const {
      primary_address,
      linked_address,
      timestamp,
      primary_signature,
      linked_signature,
    } = payload as AddressLinkCreate;

    if (
      !primary_address ||
      !linked_address ||
      !timestamp ||
      !primary_signature ||
      !linked_signature
    ) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: primary_address, linked_address, ' +
            'timestamp, primary_signature, linked_signature',
        },
        { status: 400 }
      );
    }

    if (
      !isValidBitcoinAddress(primary_address) ||
      !isValidBitcoinAddress(linked_address)
    ) {
      return NextResponse.json(
        { error: 'Invalid Bitcoin address' },
        { status: 400 }
      );
    }

    if (primary_address === linked_address) {
      return NextResponse.json(
        { error: 'Cannot link an address to itself' },
        { status: 400 }
      );
    }

    if (typeof timestamp !== 'number' || isTimestampStale(timestamp)) {
      return NextResponse.json(
        { error: 'Challenge timestamp is stale; retry the link flow' },
        { status: 400 }
      );
    }

    const message = buildLinkMessage(
      primary_address,
      linked_address,
      timestamp
    );

    if (!verifyBip322Signature(primary_address, message, primary_signature)) {
      return NextResponse.json(
        { error: 'Invalid signature from primary address' },
        { status: 401 }
      );
    }

    if (!verifyBip322Signature(linked_address, message, linked_signature)) {
      return NextResponse.json(
        { error: 'Invalid signature from linked address' },
        { status: 401 }
      );
    }

    const db = getDb();

    // Links are single-level: an alias cannot have aliases of its own,
    // and a primary cannot itself be an alias.
    if (getPrimaryFor(primary_address)) {
      return NextResponse.json(
        { error: 'Primary address is already linked to another address' },
        { status: 409 }
      );
    }

    if (getPrimaryFor(linked_address)) {
      return NextResponse.json(
        { error: 'Address is already linked to another address' },
        { status: 409 }
      );
    }

    if (getLinkedAddresses(linked_address).length > 0) {
      return NextResponse.json(
        { error: 'Address has links of its own and cannot become an alias' },
        { status: 409 }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO address_links (primary_address, linked_address, linked_at)
       VALUES (?, ?, ?)`
    ).run(primary_address, linked_address, now);

    // Keep (or start) collecting stats for the alias: rigs may still
    // point at it, and its history feeds the primary's aggregates.
    db.prepare(
      `INSERT INTO monitored_users (
         address, is_active, is_public, created_at, updated_at, authorised_at
       ) VALUES (?, 1, 1, ?, ?, ?)
       ON CONFLICT(address) DO UPDATE SET
         is_active = 1,
         failed_attempts = 0,
         updated_at = excluded.updated_at`
    ).run(linked_address, now, now, now);

    return NextResponse.json(linksResponse(primary_address));
  } catch (error) {
    console.error('Error creating address link:', error);
    return NextResponse.json(
      { error: 'Failed to create address link' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    let payload: Partial<AddressLinkDelete>;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { primary_address, linked_address, timestamp, signature } =
      payload as AddressLinkDelete;

    if (!primary_address || !linked_address || !timestamp || !signature) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: primary_address, linked_address, ' +
            'timestamp, signature',
        },
        { status: 400 }
      );
    }

    if (
      !isValidBitcoinAddress(primary_address) ||
      !isValidBitcoinAddress(linked_address)
    ) {
      return NextResponse.json(
        { error: 'Invalid Bitcoin address' },
        { status: 400 }
      );
    }

    if (typeof timestamp !== 'number' || isTimestampStale(timestamp)) {
      return NextResponse.json(
        { error: 'Challenge timestamp is stale; retry the unlink flow' },
        { status: 400 }
      );
    }

    const message = buildUnlinkMessage(
      primary_address,
      linked_address,
      timestamp
    );

    if (!verifyBip322Signature(primary_address, message, signature)) {
      return NextResponse.json(
        { error: 'Invalid signature from primary address' },
        { status: 401 }
      );
    }

    const db = getDb();
    const result = db
      .prepare(
        `DELETE FROM address_links
         WHERE primary_address = ? AND linked_address = ?`
      )
      .run(primary_address, linked_address);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    return NextResponse.json(linksResponse(primary_address));
  } catch (error) {
    console.error('Error deleting address link:', error);
    return NextResponse.json(
      { error: 'Failed to delete address link' },
      { status: 500 }
    );
  }
}
