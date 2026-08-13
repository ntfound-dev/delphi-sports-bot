import { DelphiClient } from "@gensyn-ai/gensyn-delphi-sdk";
import { config } from "./config.js";

/**
 * Single shared DelphiClient instance for the whole bot.
 * Uses local private-key signing (signerType: "private_key") so the bot can
 * run fully unattended on a VPS without a CDP wallet dependency.
 */
export function createDelphiClient(): DelphiClient {
  if (!config.privateKey) {
    throw new Error(
      "WALLET_PRIVATE_KEY is not set. Put your Gensyn competition wallet's private key in .env — " +
        "this must be the SAME wallet address you registered on the DoraHacks competition page."
    );
  }
  if (!config.apiKey) {
    throw new Error(
      "DELPHI_API_ACCESS_KEY is not set. Create a testnet API key (see Panduan Agen Pemula) — " +
        "required for read operations (listMarkets, listPositions, etc)."
    );
  }

  return new DelphiClient({
    network: config.network, // "competition-testnet" for this competition
    signerType: config.signerType,
    privateKey: config.privateKey,
    apiKey: config.apiKey,
  });
}
