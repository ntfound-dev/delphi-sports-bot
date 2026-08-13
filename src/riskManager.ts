import { config } from "./config.js";

export interface SizingInput {
  currentBalance: bigint; // token balance, 18 decimals
  finalEdge: number; // combined edge after news assessment (modelProbability - marketPrice)
  marketPrice: number; // implied probability of the outcome being bought
}

/**
 * Confidence-scaled position sizing:
 *   - Bigger edge -> bigger size, but capped at maxPositionFraction of balance.
 *   - Edge below config.strategy.minEdge is rejected entirely.
 *   - An absolute per-trade cap can also be set via MAX_TOKENS_PER_TRADE.
 *
 * Sizing scales linearly from 0 (at minEdge) to maxPositionFraction (at edge=0.4+),
 * so marginal signals get small size and strong signals get closer to the cap.
 */
export function sizePosition(input: SizingInput): bigint {
  const { minEdge, maxPositionFraction, maxTokensPerTrade } = config.strategy;
  if (input.finalEdge < minEdge) return 0n;

  const scale = Math.min(1, (input.finalEdge - minEdge) / 0.3); // ramps to full size by edge=minEdge+0.3
  const fraction = maxPositionFraction * scale;

  // bigint-safe fraction multiply: scale to basis points to avoid floating point on bigint
  const bps = BigInt(Math.round(fraction * 10_000));
  let amount = (input.currentBalance * bps) / 10_000n;

  if (maxTokensPerTrade > 0n && amount > maxTokensPerTrade) {
    amount = maxTokensPerTrade;
  }

  return amount;
}

/**
 * Applies slippage tolerance to a quoted token amount, returning the
 * max/min bound to pass into buyShares/sellShares for protection.
 */
export function withSlippage(amount: bigint, direction: "max" | "min"): bigint {
  const bps = BigInt(config.strategy.slippageBps);
  const delta = (amount * bps) / 10_000n;
  return direction === "max" ? amount + delta : amount - delta;
}
