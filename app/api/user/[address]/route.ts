import { NextResponse } from 'next/server';
import { formatDifficulty, parseHashrate } from '@/app/utils/formatters';
import { formatRelativeTime } from '@/app/utils/formatters';
import { fetch } from '@/lib/http-client';
import { fetchWithCache } from '@/lib/aggregator-cache';
import { resolveAddressSet } from '@/lib/address-links';

export interface WorkerData {
  workername: string;
  hashrate1m: string;
  hashrate5m: string;
  hashrate1hr: string;
  hashrate1d: string;
  hashrate7d: string;
  lastshare: number;
  shares: number;
  bestshare: number;
  bestever: number;
}

export interface UserData {
  hashrate1m: string;
  hashrate5m: string;
  hashrate1hr: string;
  hashrate1d: string;
  hashrate7d: string;
  lastshare: number;
  workers: number;
  shares: number;
  bestshare: number;
  bestever: number;
  authorised: number;
  worker: WorkerData[];
}

export interface ProcessedUserData {
  hashrate: number;
  workers: number;
  lastSubmission: string;
  bestDifficulty: string;
  uptime: string;
  workerData: ProcessedWorkerData[];
}

export interface ProcessedWorkerData {
  id: string;
  name: string;
  hashrate: string;
  bestDifficulty: string;
  lastSubmission: string;
  uptime: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      console.error("Failed to fetch user data: No API_URL defined in env");
      return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
    }

    const headers: Record<string, string> = {};
    if (process.env.API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
    }

    const fetchUserData = (userAddress: string) =>
      fetchWithCache<UserData>(
        `${apiUrl}/aggregator/users/${userAddress}`,
        async () => {
          const response = await fetch(
            `${apiUrl}/aggregator/users/${userAddress}`,
            { headers }
          );
          if (!response.ok) {
            throw new Error(`Failed to fetch user data: ${response.statusText} (${response.status})`);
          }
          return await response.json() as UserData;
        },
      );

    const { data: userData } = await fetchUserData(address);

    // Rigs may still point at linked (alias) addresses; fold their live
    // stats into the primary's. Alias fetch failures are non-fatal (an
    // alias may have no aggregator record yet).
    const linkedAddresses = resolveAddressSet(address).slice(1);
    const linkedData: UserData[] = [];
    for (const linked of linkedAddresses) {
      try {
        const { data } = await fetchUserData(linked);
        linkedData.push(data);
      } catch (error) {
        console.warn(`Skipping linked address ${linked}:`, error);
      }
    }

    const allData = [userData, ...linkedData];

    // Process the user data, summed/merged across the address set
    const processedData: ProcessedUserData = {
      hashrate: allData.reduce(
        (sum, d) => sum + parseHashrate(d.hashrate5m), 0
      ),
      workers: allData.reduce((sum, d) => sum + d.workers, 0),
      lastSubmission: formatRelativeTime(
        Math.max(...allData.map(d => d.lastshare))
      ),
      bestDifficulty: formatDifficulty(
        Math.max(...allData.map(d => d.bestever))
      ),
      // Earliest authorisation across the set = longest uptime
      uptime: calculateUptime(
        Math.min(...allData.map(d => d.authorised))
      ),
      workerData: processWorkerData(allData.flatMap(d => d.worker)),
    };

    return NextResponse.json(processedData);
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}

function processWorkerData(workers: WorkerData[]): ProcessedWorkerData[] {
  return workers.map(worker => {
    const nameParts = worker.workername.split('.');
    const name = nameParts.length > 1 ? nameParts[1] : 'default';
    
    return {
      id: worker.workername,
      name: name,
      hashrate: parseHashrate(worker.hashrate5m).toString(),
      bestDifficulty: worker.bestever.toString(),
      lastSubmission: worker.lastshare.toString(),
      uptime: 'N/A', // We don't have direct uptime information for workers
    };
  });
}

function calculateUptime(authorisedTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000); // Current time in Unix timestamp
  const uptimeSeconds = now - authorisedTimestamp;

  const days = Math.floor(uptimeSeconds / (24 * 60 * 60));
  const hours = Math.floor((uptimeSeconds % (24 * 60 * 60)) / (60 * 60));

  return `${days}d ${hours}h`;
}

