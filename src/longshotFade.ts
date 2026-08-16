import { config } from "./config.js";
import type { ScannedMarket } from "./marketScanner.js";

export type Direction = "buy_favorite" | "fade_longshot";

export interface PriceSignal {
  market: ScannedMarket;
  outcomeIdx: number;
  outcomeName: string;
  marketPrice: number;
  direction: Direction;
  priorEdge: number;
}

/**
 * Generate candidate signals for binary sports markets.
 *
 * The old implementation only considered 5-15% longshots and
 * 75-92% favorites. That caused normal markets (e.g. 58.6/41.4)
 * to never reach the news/LLM layer.
 *
 * We now let every valid binary market reach the model layer.
 * The model/risk layer remains responsible for deciding whether
 * the estimated edge is large enough to trade.
 */
export function detectLongshotFadeSignals(markets: ScannedMarket[]): PriceSignal[] {
  const signals: PriceSignal[] = [];

  for (const market of markets) {
    const probs = market.spotImpliedProbabilities;
    const outcomes = market.metadata?.outcomes;

    if (!probs || !outcomes || probs.length !== outcomes.length) continue;

    // Current strategy is intentionally restricted to binary markets.
    if (outcomes.length !== 2 || probs.length !== 2) continue;

    for (let idx = 0; idx < 2; idx++) {
      const p = probs[idx];

      if (!Number.isFinite(p) || p <= 0 || p >= 1) continue;

      const isLongshot =
        p >= config.strategy.longshotMinPrice &&
        p <= config.strategy.longshotMaxPrice;

      const isFavorite =
        p >= config.strategy.favoriteMinPrice &&
        p <= config.strategy.favoriteMaxPrice;

      let direction: Direction;
      let priorEdge: number;

      if (isLongshot) {
        direction = "fade_longshot";
        const otherIdx = idx === 0 ? 1 : 0;

        signals.push({
          market,
          outcomeIdx: otherIdx,
          outcomeName: outcomes[otherIdx],
          marketPrice: probs[otherIdx],
          direction,
          priorEdge: Math.max(0, p - 0.07),
        });

        continue;
      }

      if (isFavorite) {
        direction = "buy_favorite";
        priorEdge = Math.max(0, 0.96 - p);

        signals.push({
          market,
          outcomeIdx: idx,
          outcomeName: outcomes[idx],
          marketPrice: p,
          direction,
          priorEdge,
        });

        continue;
      }

      // Normal-priced market:
      // expose BOTH outcomes to the news/model layer.
      // No statistical prior is assumed here.
      signals.push({
        market,
        outcomeIdx: idx,
        outcomeName: outcomes[idx],
        marketPrice: p,
        direction: idx === 0 ? "buy_favorite" : "buy_favorite",
        priorEdge: 0,
      });
    }
  }

  return signals;
}
