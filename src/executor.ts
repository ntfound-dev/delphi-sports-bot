import type { DelphiClient } from "@gensyn-ai/gensyn-delphi-sdk";
import { withSlippage } from "./riskManager.js";

/**
 * Buys `tokenBudget` worth of exposure to a specific outcome, quoting first
 * to convert a token budget into a share amount, ensuring token approval,
 * then sending the trade with slippage protection.
 */
export async function executeBuy(
  client: DelphiClient,
  marketAddress: `0x${string}`,
  outcomeIdx: number,
  tokenBudget: bigint
): Promise<{ transactionHash: string } | null> {
  if (tokenBudget <= 0n) return null;

  // Rough share estimate: quote at a nominal share amount, then scale.
  // We iterate once using a small probe quote to get a price-per-share, then
  // size shares to spend approximately tokenBudget.
  const probeShares = 10n ** 18n; // 1 share probe
  const probeQuote = await client.quoteBuy({ marketAddress, outcomeIdx, sharesOut: probeShares });
  if (probeQuote.tokensIn === 0n) return null;

  const estimatedShares = (tokenBudget * probeShares) / probeQuote.tokensIn;
  if (estimatedShares === 0n) return null;

  const finalQuote = await client.quoteBuy({ marketAddress, outcomeIdx, sharesOut: estimatedShares });
  const maxTokensIn = withSlippage(finalQuote.tokensIn, "max");

  await client.ensureTokenApproval({ marketAddress, minimumAmount: maxTokensIn });

  const result = await client.buyShares({
    marketAddress,
    outcomeIdx,
    sharesOut: estimatedShares,
    maxTokensIn,
  });

  return { transactionHash: result.transactionHash };
}

/**
 * Redeems all winning/settled positions for a wallet, AND liquidates
 * positions stuck in expired/failed markets (which have no winning outcome
 * and revert if you call redeemMarket on them instead).
 *
 * Per reference/competition.md: "a competition can end with a lot of expired
 * and failed markets, so build the liquidate path into any sweep, not just
 * redeem."
 */
export async function redeemAllSettled(client: DelphiClient, wallet: string) {
  const { positions } = await client.listPositions({ wallet, redeemedOrLiquidated: false, limit: 200 });
  if (!positions || positions.length === 0) {
    return { redeemed: { results: [], totalTokensOut: 0n }, liquidated: [] as string[] };
  }

  const settledMarkets = positions
    .filter((p) => p.marketStatus === "settled")
    .map((p) => p.marketProxy as `0x${string}`);

  const exitableViaLiquidate = positions.filter(
    (p) => p.marketStatus === "expired" || p.marketStatus === "failed"
  );

  const redeemed =
    settledMarkets.length > 0
      ? await client.redeemPositions({ marketAddresses: [...new Set(settledMarkets)] })
      : { results: [], totalTokensOut: 0n };

  const liquidated: string[] = [];
  for (const pos of exitableViaLiquidate) {
    try {
      await client.liquidate({
        marketAddress: pos.marketProxy as `0x${string}`,
        outcomeIndices: [Number(pos.outcomeIdx)],
      });
      liquidated.push(pos.marketProxy);
    } catch (err) {
      // Non-fatal: log and continue sweeping the rest of the portfolio.
      console.error(`liquidate failed for ${pos.marketProxy}:`, (err as Error).message);
    }
  }

  return { redeemed, liquidated };
}
