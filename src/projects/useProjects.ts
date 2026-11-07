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
 * Builds the project list straight from GitHub: name, description, language, stars, topics and
 * homepage all come from the API, so nothing on the page is hand-written. Forks are dropped. The curated list in projects.ts is
 * only the offline fallback when the API cannot be reached.
 */
function fromGitHub(repos: GitHubRepo[]): Project[] {
  return repos
    .filter((repo) => !repo.fork)
    .map((repo) => ({
      name: repo.name,
      description: repo.description?.trim() || 'No description provided.',
      language: repo.language ?? 'Other',
      stars: repo.stars,
      topics: repo.topics.slice(0, 3).map(titleCase),
      url: repo.html_url,
      featured: false,
      // No demo link for this site's own repo: it would just link back to the page you are on
      demoUrl:
        repo.homepage?.startsWith('http') && !/github\.io/i.test(repo.homepage) ? repo.homepage : undefined,
      pushedAt: repo.pushed_at,
    }))
    .sort(
      (a, b) =>
        // Most stars first; the same stars, most recently updated first
        b.stars - a.stars ||
        (b.pushedAt ?? '').localeCompare(a.pushedAt ?? '') ||
        a.name.localeCompare(b.name),
    );
}

/**
 * The project list plus whether the live fetch is still pending. The curated list is the
 * fallback when GitHub is unreachable; while loading, the page shows a loader instead of the
 * placeholder so nothing jumps when the live list arrives.
 */
export function useProjects(enabled = true): { projects: Project[]; loading: boolean } {
  const [list, setList] = useState<Project[]>(curated);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetchRepos(controller.signal)
      .then((repos) => setList(fromGitHub(repos)))
      .catch(() => {
        /* keep curated fallback */
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [enabled]);

  return { projects: list, loading };
}
