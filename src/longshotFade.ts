import { config } from "./config.js";
import type { ScannedMarket } from "./marketScanner.js";

export type Direction = "buy_favorite" | "fade_longshot";

export interface PriceSignal {
  market: ScannedMarket;
  outcomeIdx: number;
  outcomeName: string;
  marketPrice: number; // implied probability from Delphi (0-1)
  direction: Direction;
  /**
   * Naive statistical edge assumed purely from the favorite-longshot bias
   * (see research: longshots priced 5-15% historically win ~2-12% of the time;
   * favorites priced 75-92% win more often than priced). This is a prior, not
   * a guarantee — it gets combined with the news/injury signal before trading.
   */
  priorEdge: number;
}

/**
 * Scans every outcome of every market for prices sitting in the empirically
 * documented favorite-longshot mispricing bands, and proposes a fade/buy
 * signal for each hit. Does NOT place trades — this is pure price-based
 * detection, combined later with news signals and risk sizing.
 */
export function detectLongshotFadeSignals(markets: ScannedMarket[]): PriceSignal[] {
  const signals: PriceSignal[] = [];
  const { longshotMinPrice, longshotMaxPrice, favoriteMinPrice, favoriteMaxPrice } = config.strategy;

  for (const market of markets) {
    const probs = market.spotImpliedProbabilities;
    const outcomes = market.metadata?.outcomes;
    if (!probs || !outcomes || probs.length !== outcomes.length) continue;

    probs.forEach((p, idx) => {
      if (p >= longshotMinPrice && p <= longshotMaxPrice) {
        // Fade the longshot: bet on the OTHER outcome(s), effectively "buy No".
        // For binary markets (2 outcomes) this means buying the complementary outcome.
        if (outcomes.length === 2) {
          const otherIdx = idx === 0 ? 1 : 0;
          signals.push({
            market,
            outcomeIdx: otherIdx,
            outcomeName: outcomes[otherIdx],
            marketPrice: probs[otherIdx],
            direction: "fade_longshot",
            // Prior: longshots at 5-15% actually win closer to ~7% on average historically,
            // so the complementary outcome is underpriced by roughly that gap.
            priorEdge: p - 0.07,
          });
        }
      }

      if (p >= favoriteMinPrice && p <= favoriteMaxPrice) {
        signals.push({
          market,
          outcomeIdx: idx,
          outcomeName: outcomes[idx],
          marketPrice: p,
          direction: "buy_favorite",
          // Prior: favorites at 75-92% actually win closer to 96-98% historically,
          // so they're underpriced relative to their true win rate.
          priorEdge: 0.96 - p,
        });
      }
    });
  }

  return signals;
}
