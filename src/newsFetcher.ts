import { config } from "./config.js";

const NEWS_ENDPOINT = "https://newsapi.org/v2/everything";

export async function fetchSportsNews(question: string): Promise<string | null> {
  if (!config.newsApiKey) {
    return null;
  }

  // Extract useful team/event terms from the market question.
  const query = question
    .replace(/[?"']/g, "")
    .replace(/\bwill\b/gi, "")
    .replace(/\b(on|in|the)\b/gi, " ")
    .trim();

  const url = new URL(NEWS_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "8");
  url.searchParams.set("apiKey", config.newsApiKey);

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`NewsAPI error ${response.status}: ${text}`);
  }

  const data = await response.json() as {
    status?: string;
    articles?: Array<{
      title?: string;
      description?: string;
      publishedAt?: string;
      source?: { name?: string };
    }>;
  };

  const articles = data.articles ?? [];

  if (articles.length === 0) {
    return null;
  }

  return articles
    .map((a, i) =>
      `${i + 1}. ${a.title ?? "(untitled)"}\n` +
      `Source: ${a.source?.name ?? "unknown"}\n` +
      `Published: ${a.publishedAt ?? "unknown"}\n` +
      `${a.description ?? ""}`
    )
    .join("\n\n");
}
