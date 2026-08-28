import { NextResponse } from 'next/server';

const MAX_REFLECTED_ERROR_LENGTH = 300;

/**
 * Build a client response for a failed upstream call. Upstream 4xx bodies are
 * first-party API errors written for consumers, so they pass through
 * (truncated) as user-actionable detail. 5xx bodies may contain internal
 * details, so the client gets a generic message and the body is logged.
 */
export async function upstreamErrorResponse(
  response: Response,
  fallbackMessage: string,
  logContext: string,
): Promise<NextResponse> {
  const text = await response.text().catch(() => '');

  if (response.status >= 500) {
    console.error(`${logContext} (${response.status}):`, text || response.statusText);
    return NextResponse.json({ error: fallbackMessage }, { status: response.status });
  }

  const detail = text.trim().slice(0, MAX_REFLECTED_ERROR_LENGTH);
  return NextResponse.json(
    { error: detail ? `${fallbackMessage}: ${detail}` : fallbackMessage },
    { status: response.status }
  );
}
