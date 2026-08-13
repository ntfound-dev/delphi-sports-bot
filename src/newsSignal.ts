import { config } from "./config.js";
import type { PriceSignal } from "./longshotFade.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export interface NewsAssessment {
  /** Model's own probability estimate for the specific outcome being considered (0-1). */
  modelProbability: number;
  /** Short justification, logged for later review. */
  reasoning: string;
  /** True if the model found a specific, checkable reason (injury, lineup, suspension, etc.) */
  hasConcreteSignal: boolean;
}

/**
 * Uses Groq's free-tier LLM API (OpenAI-compatible endpoint, no credit card
 * required) to sanity-check a price-based signal against real news:
 * injuries, lineup changes, suspensions, recent form. This is the guardrail
 * against blindly trading the statistical bias when a specific, known reason
 * justifies the market's price.
 *
 * Free tier note: Groq's free plan is rate-limited (~30 requests/minute,
 * ~1,000 requests/day as of mid-2026 — limits can change, check
 * console.groq.com). If you have many signals per poll cycle, either raise
 * POLL_INTERVAL_SECONDS or add your own queuing/backoff.
 *
 * NOTE: this bot does not have live web access itself — plug in your news
 * source of choice (NEWS_API_KEY) and pass the fetched headlines into
 * `newsContext`. Without a news feed configured, this falls back to asking
 * the model to reason from the question text alone, which is weaker.
 */
export async function assessOutcomeWithNews(
  signal: PriceSignal,
  newsContext: string | null
): Promise<NewsAssessment> {
  if (!config.groqApiKey) {
    throw new Error(
      "GROQ_API_KEY not set — required for news/injury signal analysis. Get a free key at console.groq.com"
    );
  }

  const question = signal.market.metadata?.question ?? "(unknown question)";
  const outcomes = signal.market.metadata?.outcomes ?? [];

  const prompt = `You are a sports betting risk analyst helping decide whether to trade a prediction-market outcome.

Market question: ${question}
Outcomes: ${outcomes.join(", ")}
Outcome being considered: "${signal.outcomeName}" (index ${signal.outcomeIdx})
Current market-implied probability for this outcome: ${(signal.marketPrice * 100).toFixed(1)}%
Strategy prior (favorite-longshot bias only, ignoring news): ${(signal.priorEdge * 100).toFixed(1)}pp edge

${newsContext ? `Recent news/injury/lineup context:\n${newsContext}` : "No news context was provided — reason from the question text only, and be conservative."}

Give your own probability estimate (0-1) that "${signal.outcomeName}" wins/occurs, based on any concrete
information above (injuries, suspensions, recent form, matchup context). If there is a specific reason
the market price might actually be CORRECT (e.g. a star player is injured, which is exactly why the
favorite is less favored than usual), say so and adjust your estimate down toward the market price —
don't blindly apply the statistical bias when there's a concrete contradicting reason.

Respond ONLY with JSON, no other text:
{"modelProbability": <number 0-1>, "reasoning": "<one or two sentences>", "hasConcreteSignal": <true|false>}`;

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.groqApiKey}`,
    },
    body: JSON.stringify({
      model: config.llmModel,
      max_tokens: 300,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`Groq API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  const cleaned = raw.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as NewsAssessment;
    return parsed;
  } catch {
    // Fail safe: if parsing fails, return a neutral assessment that won't trigger a trade.
    return { modelProbability: signal.marketPrice, reasoning: "parse_error_fallback", hasConcreteSignal: false };
  }
}
