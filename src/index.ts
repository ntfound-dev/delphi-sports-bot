import { config, assertTradingConfigured } from "./config.js";
import { createDelphiClient } from "./delphiClient.js";
import { scanSportsMarkets } from "./marketScanner.js";
import { detectLongshotFadeSignals } from "./longshotFade.js";
import { assessOutcomeWithNews } from "./newsSignal.js";
import { fetchSportsNews } from "./newsFetcher.js";
import { sizePosition } from "./riskManager.js";
import { executeBuy, redeemAllSettled } from "./executor.js";

function log(...args: unknown[]) {
  console.log(new Date().toISOString(), ...args);
}

async function runOnce() {
  const client = createDelphiClient();
  const signer = await client.getSigner();
  const wallet = signer.address as string;

  log(`Scanning sports markets (wallet ${wallet})...`);
  const markets = await scanSportsMarkets(client);
  log(`Found ${markets.length} open sports markets within the settlement window.`);

  const priceSignals = detectLongshotFadeSignals(markets);
  log(`${priceSignals.length} price-based longshot/favorite signals detected.`);

  for (const m of markets) {
    log(
      `[MARKET] ${m.metadata?.question ?? m.id} ` +
      `outcomes=${JSON.stringify(m.metadata?.outcomes ?? [])} ` +
      `probs=${JSON.stringify(m.spotImpliedProbabilities ?? [])} ` +
      `settlesAt=${m.settlesAt ?? "unknown"} ` +
      `hoursToSettlement=${m.hoursToSettlement?.toFixed(2) ?? "unknown"}`
    );
  }

  for (const market of markets) {
    log(
      `[MARKET] ${market.metadata?.question ?? market.id} ` +
      `outcomes=${JSON.stringify(market.metadata?.outcomes)} ` +
      `probs=${JSON.stringify(market.spotImpliedProbabilities)}`
    );
  }

  const balance = await client.getErc20Balance();
  log(`Current token balance: ${balance.toString()}`);

  // First, try to redeem/liquidate anything already settled/expired/failed —
  // realize P&L and free up stuck collateral before risking more.
  const { redeemed, liquidated } = await redeemAllSettled(client, wallet);
  if (redeemed.results.length > 0) {
    log(`Redeemed ${redeemed.results.length} settled position(s), total ${redeemed.totalTokensOut.toString()} tokens.`);
  }
  if (liquidated.length > 0) {
    log(`Liquidated ${liquidated.length} expired/failed position(s): ${liquidated.join(", ")}`);
  }

  for (const signal of priceSignals) {
    try {
      // Fetch fresh sports news before asking the LLM for a probability.
      const question = signal.market.metadata?.question ?? "";
      const newsContext = await fetchSportsNews(question);

      log(
        `  -> news context: ${
          newsContext ? "available" : "none"
        }`
      );

      // Combine the price-based prior with the live news context.
      const assessment = await assessOutcomeWithNews(signal, newsContext);
      const finalEdge = assessment.modelProbability - signal.marketPrice;

      log(
        `[${signal.market.metadata?.question ?? signal.market.id}] outcome="${signal.outcomeName}" ` +
          `marketPrice=${signal.marketPrice.toFixed(3)} priorEdge=${signal.priorEdge.toFixed(3)} ` +
          `llmProb=${assessment.modelProbability.toFixed(3)} finalEdge=${finalEdge.toFixed(3)} ` +
          `concreteSignal=${assessment.hasConcreteSignal} :: ${assessment.reasoning}`
      );

      const size = sizePosition({ currentBalance: balance, finalEdge, marketPrice: signal.marketPrice });
      if (size <= 0n) {
        log(`  -> skip (edge below threshold or below minimum size)`);
        continue;
      }

      const result = await executeBuy(client, signal.market.id as `0x${string}`, signal.outcomeIdx, size);
      if (result) {
        log(`  -> TRADE EXECUTED tx=${result.transactionHash} budget=${size.toString()}`);
      } else {
        log(`  -> trade skipped (quote returned zero)`);
      }
    } catch (err) {
      log(`  -> ERROR processing signal for market ${signal.market.id}:`, (err as Error).message);
    }
  }
}

async function main() {
  assertTradingConfigured();
  const intervalMs = config.strategy.pollIntervalSeconds * 1000;

  log(`Starting Delphi sports longshot-fade bot. Poll interval: ${config.strategy.pollIntervalSeconds}s`);

  // Run immediately, then on an interval, so a crash+restart (e.g. via a
  // process manager like pm2) doesn't wait a full cycle before trading.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await runOnce();
    } catch (err) {
      log("Fatal error in runOnce, will retry next cycle:", err);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

main().catch((err) => {
  console.error("Bot crashed:", err);
  process.exit(1);
});
