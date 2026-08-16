import { config } from "./config.js";
import type { PriceSignal } from "./longshotFade.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export interface NewsAssessment {
  modelProbability: number;
  reasoning: string;
  hasConcreteSignal: boolean;
}

export async function assessOutcomeWithNews(
  signal: PriceSignal,
  newsContext: string | null
): Promise<NewsAssessment> {
  if (!config.groqApiKey) {
    throw new Error("GROQ_API_KEY not set");
  }

  const question = signal.market.metadata?.question ?? "(unknown question)";
  const outcomes = signal.market.metadata?.outcomes ?? [];
  const probs = signal.market.spotImpliedProbabilities;

  if (!probs || probs.length !== 2) {
    return {
      modelProbability: signal.marketPrice,
      reasoning: "missing_binary_market_probabilities",
      hasConcreteSignal: false,
    };
  }

  const marketP0 = probs[0];
  const marketP1 = probs[1];

  if (
    !Number.isFinite(marketP0) ||
    !Number.isFinite(marketP1)
  ) {
    return {
      modelProbability: signal.marketPrice,
      reasoning: "invalid_market_probabilities",
      hasConcreteSignal: false,
    };
  }

  if (outcomes.length !== 2) {
    return {
      modelProbability: signal.marketPrice,
      reasoning: "non_binary_market",
      hasConcreteSignal: false,
    };
  }

  const yesOutcome = outcomes[0];
  const noOutcome = outcomes[1];

  const prompt = `You are a conservative sports prediction-market analyst.

Market question:
${question}

Binary outcomes:
1. "${yesOutcome}"
2. "${noOutcome}"

Current market probabilities:
${yesOutcome}: ${(marketP0 * 100).toFixed(1)}%
${noOutcome}: ${(marketP1 * 100).toFixed(1)}%

${newsContext
  ? `Recent verified news:\n${newsContext}`
  : "No verified live news was provided."}

Estimate the TRUE probability of outcome "${yesOutcome}".

Rules:
- The two probabilities MUST sum to exactly 100%.
- Do not invent injuries, lineups, statistics, or news.
- If there is no concrete evidence that the market is wrong, stay close to the market probability.
- General team reputation is NOT concrete evidence.
- Only move substantially away from the market when there is specific, relevant evidence.
- Without concrete evidence, use a conservative adjustment of at most 3 percentage points.
- Do not output 0% or 100% unless there is overwhelming deterministic evidence.
- This is a probability estimate, not a betting recommendation.

Return ONLY JSON:
{
  "probabilityOutcome0": number,
  "reasoning": "one or two sentences",
  "hasConcreteSignal": boolean
}`;

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.groqApiKey}`,
    },
    body: JSON.stringify({
      model: config.llmModel,
      max_tokens: 250,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Groq API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const raw = data.choices?.[0]?.message?.content ?? "{}";
  const cleaned = raw.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as {
      probabilityOutcome0?: number;
      reasoning?: string;
      hasConcreteSignal?: boolean;
    };

    let p0 = Number(parsed.probabilityOutcome0);

    if (!Number.isFinite(p0)) {
      p0 = marketP0;
    }

    p0 = Math.max(0.01, Math.min(0.99, p0));

    /*
     * No concrete evidence:
     * keep the model close to the market.
     */
    if (parsed.hasConcreteSignal !== true) {
      const maxDeviation = 0.03;

      p0 = Math.max(
        marketP0 - maxDeviation,
        Math.min(marketP0 + maxDeviation, p0)
      );
    }

    /*
     * Derive the requested outcome probability.
     *
     * This guarantees:
     *
     * P(Yes) + P(No) = 1
     */
    const requestedProbability =
      signal.outcomeIdx === 0 ? p0 : 1 - p0;

    return {
      modelProbability: requestedProbability,
      reasoning:
        parsed.reasoning || "No reasoning provided.",
      hasConcreteSignal:
        parsed.hasConcreteSignal === true,
    };
  } catch {
    return {
      modelProbability: signal.marketPrice,
      reasoning: "parse_error_fallback",
      hasConcreteSignal: false,
    };
  }
}
