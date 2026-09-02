// Live repo data for the Projects page.
//
// One unauthenticated call to the GitHub REST API returns every public repo
// (name, description, language, stars, topics), so the whole page costs a
// single request. The trimmed result is cached in localStorage for a few
// hours to stay well under the 60/hour unauthenticated rate limit and to
// render instantly on repeat visits. If the call fails, callers fall back to
// the curated list in projects.ts.

const GH_USER = 'LongpanZhou';
const CACHE_KEY = 'gh-repos-v1';
const TTL_MS = 6 * 60 * 60 * 1000;

export interface GitHubRepo {
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stars: number;
  topics: string[];
  fork: boolean;
  archived: boolean;
  pushed_at: string;
}

interface Cache {
  fetchedAt: number;
  repos: GitHubRepo[];
}

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cache;
    if (typeof parsed?.fetchedAt === 'number' && Array.isArray(parsed.repos)) {
      return parsed;
    }
  } catch {
    /* private mode, corrupt JSON, etc. */
  }
  return null;
}

function writeCache(repos: GitHubRepo[]): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), repos } satisfies Cache),
    );
  } catch {
    /* quota / private mode — non-fatal */
  }
}

interface RawRepo {
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  topics?: string[];
  fork: boolean;
  archived: boolean;
  pushed_at: string;
}

/** Every owned public repo, trimmed. Throws on network/API failure. */
export async function fetchRepos(signal?: AbortSignal): Promise<GitHubRepo[]> {
  const cached = readCache();
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.repos;

  const res = await fetch(
    `https://api.github.com/users/${GH_USER}/repos?per_page=100&type=owner&sort=pushed`,
    { signal, headers: { Accept: 'application/vnd.github+json' } },
  );
  if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);

  const raw = (await res.json()) as RawRepo[];
  const repos: GitHubRepo[] = raw
    .filter((r) => r && typeof r.name === 'string')
    .map((r) => ({
      name: r.name,
      description: r.description,
      html_url: r.html_url,
      homepage: r.homepage,
      language: r.language,
      stars: r.stargazers_count ?? 0,
      topics: Array.isArray(r.topics) ? r.topics : [],
      fork: !!r.fork,
      archived: !!r.archived,
      pushed_at: r.pushed_at,
    }));
  writeCache(repos);
  return repos;
}
