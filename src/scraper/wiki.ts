import { z } from "zod";

const API_URL = "https://superautopets.wiki.gg/api.php";
const USER_AGENT = "pt-sap/0.1 (private research scraper; standalone project)";
const REQUEST_DELAY_MS = 350;

const WikiPageSchema = z
  .object({
    title: z.string(),
    pageid: z.number(),
    missing: z.boolean().optional(),
    revisions: z
      .array(
        z
          .object({
            slots: z
              .object({
                main: z
                  .object({
                    content: z.string().optional(),
                    "*": z.string().optional()
                  })
                  .passthrough()
                  .optional()
              })
              .passthrough()
              .optional(),
            "*": z.string().optional()
          })
          .passthrough()
      )
      .optional()
  })
  .passthrough();

const WikiResponseSchema = z
  .object({
    error: z.object({ code: z.string(), info: z.string() }).optional(),
    query: z
      .object({
        categorymembers: z
          .array(z.object({ title: z.string() }).passthrough())
          .optional(),
        pages: z.array(WikiPageSchema).optional()
      })
      .passthrough()
      .optional(),
    continue: z
      .object({ cmcontinue: z.string().optional() })
      .passthrough()
      .optional()
  })
  .passthrough();

export type WikiPage = z.infer<typeof WikiPageSchema>;
type WikiResponse = z.infer<typeof WikiResponseSchema>;

let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const wait = lastRequestAt + REQUEST_DELAY_MS - Date.now();
  if (wait > 0) {
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, wait);
    await promise;
  }
  lastRequestAt = Date.now();
}

async function api(params: Record<string, string>): Promise<WikiResponse> {
  await throttle();
  const search = new URLSearchParams({
    ...params,
    format: "json",
    formatversion: "2"
  });
  const response = await fetch(`${API_URL}?${search.toString()}`, {
    headers: { "User-Agent": USER_AGENT }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Wiki API ${response.status}: ${body.slice(0, 300)}`);
  }
  const parsed = WikiResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error(`Unexpected wiki response: ${parsed.error.message}`);
  }
  if (parsed.data.error) {
    throw new Error(
      `Wiki API error: ${parsed.data.error.code}: ${parsed.data.error.info}`
    );
  }
  return parsed.data;
}

export async function getCategoryMembers(category: string): Promise<string[]> {
  const titles: string[] = [];
  let continuation: string | undefined;
  do {
    const params: Record<string, string> = {
      action: "query",
      list: "categorymembers",
      cmtitle: category,
      cmlimit: "500"
    };
    if (continuation) params.cmcontinue = continuation;
    const json = await api(params);
    const members = json.query?.categorymembers ?? [];
    for (const member of members) titles.push(member.title);
    continuation = json.continue?.cmcontinue;
  } while (continuation);
  return titles;
}

export function extractPageContent(page: WikiPage): string {
  const revision = page.revisions?.[0];
  if (!revision) return "";
  return (
    revision.slots?.main?.content ??
    revision.slots?.main?.["*"] ??
    revision["*"] ??
    ""
  );
}

export async function getPages(
  titles: string[]
): Promise<Array<{ title: string; pageid: number; content: string; fetchedAt: string }>> {
  const pages: Array<{
    title: string;
    pageid: number;
    content: string;
    fetchedAt: string;
  }> = [];
  const batchSize = 50;
  for (let i = 0; i < titles.length; i += batchSize) {
    const batch = titles.slice(i, i + batchSize);
    const json = await api({
      action: "query",
      prop: "revisions",
      rvslots: "main",
      rvprop: "content",
      titles: batch.join("|")
    });
    const returned = json.query?.pages ?? [];
    for (const page of returned) {
      if (page.missing) {
        throw new Error(`Wiki page missing: ${page.title}`);
      }
      pages.push({
        title: page.title,
        pageid: page.pageid,
        content: extractPageContent(page),
        fetchedAt: new Date().toISOString()
      });
    }
  }
  return pages;
}

export { API_URL, USER_AGENT };
