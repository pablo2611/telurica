import { createServerFn } from "@tanstack/react-start";
import { XMLParser } from "fast-xml-parser";

const FEED = "https://news.google.com/rss/search?q=sismo%20Panam%C3%A1&hl=es-419&gl=PA&ceid=PA:es-419";
const TTL = 15 * 60_000;

type Headline = { title: string; source: string; date: string; link: string };
type RssItem = { title?: unknown; source?: unknown; pubDate?: unknown; link?: unknown };

async function fetchHeadlines(): Promise<Headline[]> {
  const response = await fetch(FEED, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("RSS no disponible");
  const xml = await response.text();
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("RSS inesperado");
  const parser = new XMLParser({ isArray: (name) => name === "item", parseTagValue: false });
  const entries: RssItem[] = parser.parse(xml)?.rss?.channel?.item ?? [];
  return entries.flatMap((item) => {
    if (typeof item.title !== "string" || typeof item.link !== "string" || typeof item.pubDate !== "string") return [];
    const link = URL.parse(item.link);
    const date = new Date(item.pubDate);
    if (link?.protocol !== "https:" || Number.isNaN(date.valueOf())) return [];
    return [{ title: item.title, source: typeof item.source === "string" ? item.source : "Google News", date: date.toISOString(), link: link.href }];
  }).slice(0, 8);
}

let cached: { expires: number; data: Promise<Headline[]> } | undefined;
export const getHeadlines = createServerFn({ method: "GET" }).handler(() => {
  if (cached && cached.expires > Date.now()) return cached.data;
  const data = fetchHeadlines().catch((error: unknown) => {
    if (cached?.data === data) cached = undefined;
    throw error;
  });
  cached = { expires: Date.now() + TTL, data };
  return data;
});
