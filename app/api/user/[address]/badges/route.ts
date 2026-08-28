import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBadgesCached } from '@/lib/badges-collector';
import { isValidBitcoinAddress } from '@/app/utils/validators';
import { checkRateLimit, getRateLimitHeaders } from '@/app/api/lib/rate-limit';
import type { BadgesPayload } from '@/lib/badge-types';

export type UserBadgesResponse = BadgesPayload;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const rateLimitResult = checkRateLimit(request);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimitResult),
      }
    );
  }

  try {
    const { address } = await params;

    if (!isValidBitcoinAddress(address)) {
      return NextResponse.json({ error: 'Invalid Bitcoin address' }, { status: 400 });
    }

    const db = getDb();

    // Privacy check: return 403 if user is private
    const userPublicCheck = db.prepare(
      `SELECT is_public FROM monitored_users WHERE address = ?`
    ).get(address) as { is_public: number } | undefined;

    if (userPublicCheck && !userPublicCheck.is_public) {
      return NextResponse.json({ error: 'This user profile is private' }, { status: 403 });
    }

    const badges = await getBadgesCached(address);

    if (!badges) {
      return NextResponse.json(
        { error: 'No badges found for this address' },
        { status: 404 }
      );
    }

    return NextResponse.json(badges, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('Error serving user badges:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
