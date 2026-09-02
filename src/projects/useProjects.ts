import { useEffect, useState } from 'react';
import { projects as curated, type Project } from '../data/projects';
import { fetchRepos, type GitHubRepo } from '../data/githubRepos';

const titleCase = (slug: string): string =>
  slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

/**
 * Merge the live GitHub repo list with the curated entries in projects.ts.
 * A curated entry keeps its polished description / topics / demo link but
 * takes its star count and language from GitHub. Repos with no curated entry
 * are added using GitHub's own metadata. Forks are dropped.
 */
function merge(repos: GitHubRepo[]): Project[] {
  const byName = new Map(curated.map((p) => [p.name.toLowerCase(), p]));
  const seen = new Set<string>();
  const out: Project[] = [];

  for (const repo of repos) {
    // Skip forks and the special profile-README repo (LongpanZhou/LongpanZhou).
    if (repo.fork || repo.name.toLowerCase() === 'longpanzhou') continue;
    const key = repo.name.toLowerCase();
    seen.add(key);
    const c = byName.get(key);
    if (c) {
      out.push({
        ...c,
        stars: repo.stars,
        language: repo.language ?? c.language,
      });
    } else {
      out.push({
        name: repo.name,
        description: repo.description?.trim() || 'No description provided.',
        language: repo.language ?? 'Other',
        stars: repo.stars,
        topics: repo.topics.slice(0, 3).map(titleCase),
        url: repo.html_url,
        featured: false,
        demoUrl: repo.homepage?.startsWith('http') ? repo.homepage : undefined,
      });
    }
  }

  // Keep curated repos GitHub didn't return (private, renamed, etc.).
  for (const c of curated) {
    if (!seen.has(c.name.toLowerCase())) out.push(c);
  }

  return out.sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) ||
      b.stars - a.stars ||
      a.name.localeCompare(b.name),
  );
}

/**
 * The project list. Starts with the curated list, then swaps in the merged
 * live list once GitHub responds (or stays curated if the fetch fails).
 */
export function useProjects(): Project[] {
  const [list, setList] = useState<Project[]>(curated);

  useEffect(() => {
    const controller = new AbortController();
    fetchRepos(controller.signal)
      .then((repos) => setList(merge(repos)))
      .catch(() => {
        /* keep curated fallback */
      });
    return () => controller.abort();
  }, []);

  return list;
}
