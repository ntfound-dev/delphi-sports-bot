import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}. Check your .env file (see .env.example).`);
  }
  return value;
}

export const config = {
  // --- Delphi / wallet ---
  // Official competition env var names (see Panduan Agen Pemula):
  //   DELPHI_NETWORK=competition-testnet
  //   DELPHI_SIGNER_TYPE=private_key
  //   WALLET_PRIVATE_KEY=<registered wallet's private key>
  //   DELPHI_API_ACCESS_KEY=<testnet API key, for read operations>
  network: (process.env.DELPHI_NETWORK ?? "competition-testnet") as
    | "testnet"
    | "mainnet"
    | "competition-testnet",
  signerType: (process.env.DELPHI_SIGNER_TYPE ?? "private_key") as "private_key" | "cdp_server_wallet",
  privateKey: process.env.WALLET_PRIVATE_KEY as `0x${string}` | undefined,
  apiKey: process.env.DELPHI_API_ACCESS_KEY,
  // Optional: scopes market reads to one specific competition. Omit to use
  // whichever competition Gensyn currently has flagged active (usual case).
  competitionId: process.env.DELPHI_COMPETITION_ID || undefined,

  // --- LLM for news/injury analysis (Groq — free tier, no credit card) ---
  groqApiKey: process.env.GROQ_API_KEY,
  llmModel: process.env.LLM_MODEL ?? "llama-3.3-70b-versatile",

  // --- News source for injury/lineup signals ---
  newsApiKey: process.env.NEWS_API_KEY, // e.g. NewsAPI.org, or leave blank to skip

  // --- Strategy parameters ---
  strategy: {
    // Longshot-fade band: fade (bet against) outcomes priced in this range.
    longshotMinPrice: Number(process.env.LONGSHOT_MIN_PRICE ?? 0.05),
    longshotMaxPrice: Number(process.env.LONGSHOT_MAX_PRICE ?? 0.15),
    // Favorite band: buy outcomes priced in this range directly (also mispriced, other direction).
    favoriteMinPrice: Number(process.env.FAVORITE_MIN_PRICE ?? 0.75),
    favoriteMaxPrice: Number(process.env.FAVORITE_MAX_PRICE ?? 0.92),
    // Minimum edge (modelProbability - marketImpliedProbability) required to trade.
    minEdge: Number(process.env.MIN_EDGE ?? 0.1),
    // Max fraction of current token balance to risk on a single position.
    maxPositionFraction: Number(process.env.MAX_POSITION_FRACTION ?? 0.1),
    // Absolute floor/ceiling on token amount per trade regardless of balance.
    maxTokensPerTrade: BigInt(process.env.MAX_TOKENS_PER_TRADE ?? "0"), // 0 = no absolute cap
    // Only trade markets settling within this many hours (keeps positions inside the 2-week window).
    maxHoursToSettlement: Number(process.env.MAX_HOURS_TO_SETTLEMENT ?? 24 * 10),
    // How often the main loop scans markets, in seconds.
    pollIntervalSeconds: Number(process.env.POLL_INTERVAL_SECONDS ?? 120),
    // Slippage tolerance applied to quotes before sending a trade.
    slippageBps: Number(process.env.SLIPPAGE_BPS ?? 300), // 3%
  },
};

export function assertTradingConfigured() {
  required("WALLET_PRIVATE_KEY");
  required("DELPHI_API_ACCESS_KEY");
}
