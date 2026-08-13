import type { DelphiClient } from "@gensyn-ai/gensyn-delphi-sdk";
import type { Market } from "@gensyn-ai/gensyn-delphi-sdk";
import { config } from "./config.js";

export interface ScannedMarket extends Market {
  hoursToSettlement: number | null;
}

/**
 * Fetches all open sports markets (paginated) with live spot prices /
 * implied probabilities attached, filtered to markets that will settle
 * within our competition window.
 */
export async function scanSportsMarkets(client: DelphiClient): Promise<ScannedMarket[]> {
  const pageSize = 50;
  let skip = 0;
  const all: Market[] = [];

  while (true) {
    const { markets } = await client.listMarkets({
      status: "open",
      category: "sports",
      skip,
      limit: pageSize,
      pricesAndImpliedProbabilities: true,
      orderBy: "settles_at",
      ...(config.competitionId ? { competitionId: config.competitionId } : {}),
    });

    if (!markets || markets.length === 0) break;
    all.push(...markets);
    if (markets.length < pageSize) break;
    skip += pageSize;
  }

  const now = Date.now();

  return all
    .map((m) => {
      const hoursToSettlement = m.settlesAt
        ? (new Date(m.settlesAt).getTime() - now) / (1000 * 60 * 60)
        : null;
      return { ...m, hoursToSettlement };
    })
    .filter((m) => {
      // Skip markets with no price data yet, or that settle outside our window,
      // or that have already effectively closed (negative time to settlement).
      if (!m.spotImpliedProbabilities) return false;
      if (m.hoursToSettlement === null) return true; // unknown settlement time, keep but treat cautiously
      return m.hoursToSettlement > 0 && m.hoursToSettlement <= config.strategy.maxHoursToSettlement;
    });
}
