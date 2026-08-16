import { config } from "./config.js";

const NEWS_ENDPOINT = "https://newsapi.org/v2/everything";

export async function fetchSportsNews(question: string): Promise<string | null> {
  if (!config.newsApiKey) {
    console.log("[NEWS] NEWS_API_KEY is NOT loaded");
    return null;
  }

  // Build a broad sports-news query from the market question.
  // Avoid querying the entire prediction-market sentence.
  const q = question.toLowerCase();

  const teams = ["Arsenal", "Manchester City"].filter(t =>
    q.includes(t.toLowerCase())
  );

  const event =
    q.includes("community shield") ? '"Community Shield"' :
    q.includes("fa cup") ? '"FA Cup"' :
    q.includes("premier league") ? '"Premier League"' :
    "";

  const query = [...teams, event].filter(Boolean).join(" ").trim();

  console.log(`[NEWS] query="${query}"`);

  const url = new URL(NEWS_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "8");
  url.searchParams.set("apiKey", config.newsApiKey);

  console.log(`[NEWS] fetching: ${query}`);

  const response = await fetch(url);

  const data = await response.json() as {
    code?: string;
    message?: string;
    totalResults?: number;
    status?: string;
    articles?: Array<{
      title?: string;
      description?: string;
      publishedAt?: string;
      source?: { name?: string };
    }>;
  };

  console.log(
    `[NEWS] status=${response.status} apiStatus=${data.status} ` +
    `code=${data.code ?? "none"} results=${data.totalResults ?? 0}`
  );

  if (!response.ok) {
    throw new Error(
      `NewsAPI error ${response.status}: ${data.message ?? "unknown error"}`
    );
  }

  const articles = data.articles ?? [];

  if (articles.length === 0) {
    console.log("[NEWS] API returned zero articles");
    return null;
  }

  console.log(`[NEWS] using ${articles.length} articles`);

  return articles
    .map((a, i) =>
      `${i + 1}. ${a.title ?? "(untitled)"}\n` +
      `Source: ${a.source?.name ?? "unknown"}\n` +
      `Published: ${a.publishedAt ?? "unknown"}\n` +
      `${a.description ?? ""}`
    )
    .join("\n\n");
}
