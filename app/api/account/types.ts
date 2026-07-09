export type AccountMetadata = {
  block_count?: number;
  highest_blockheight?: number;
  is_private?: boolean;
  [key: string]: unknown;
};

export interface AccountMetadataUpdate {
  btc_address: string;
  metadata: Record<string, unknown>;
  signature: string;
}

export interface AccountData {
  btc_address: string;
  ln_address: string | null;
  past_ln_addresses: string[];
  total_diff: number;
  metadata: AccountMetadata | null;
  last_updated: string | null;
}

export interface AccountUpdate {
  btc_address: string,
  ln_address: string,
  signature: string,
}

// Address link (alias) types
export interface AddressLinkCreate {
  primary_address: string;
  linked_address: string;
  timestamp: number;
  primary_signature: string;
  linked_signature: string;
}

export interface AddressLinkDelete {
  primary_address: string;
  linked_address: string;
  timestamp: number;
  signature: string;
}

export interface AddressLinksResponse {
  primary_address: string;
  linked_addresses: string[];
  // Set when the queried address is itself an alias of another primary.
  linked_to: string | null;
}

// Lightning wallet types
export interface WalletInfo {
  email: string;
  id: string;
  lightning_ln_onchain: string;
  lightning_ln_url: string;
  username: string;
}

export interface BalanceResponse {
  balance: number;
}

// Combined response type for account endpoint
export interface CombinedAccountResponse {
  account: AccountData | null;
  lightning: {
    walletInfo: WalletInfo;
    balance: number;
  } | null;
  lightningTokenExpired?: boolean;
}
