import { Injectable, signal, computed } from '@angular/core';

export interface WikiSearchResult {
  pageid: number;
  title: string;
}

export interface WikiPageSummary {
  title: string;
  description?: string;
  thumbnail?: { source: string };
  originalimage?: { source: string };
}

const DEBOUNCE_MS = 300;
const CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const SEARCH_API =
  'https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=4&format=json&origin=*';
const SUMMARY_BASE = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

interface CacheEntry<T> {
  data: T;
  at: number;
}

@Injectable({ providedIn: 'root' })
export class WikipediaSearchService {
  private results = signal<WikiSearchResult[]>([]);
  private loading = signal(false);
  private summaryLoading = signal(false);
  private searchCache = new Map<string, CacheEntry<WikiSearchResult[]>>();
  private summaryCache = new Map<string, CacheEntry<WikiPageSummary>>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;

  readonly searchResults = computed(() => this.results());
  readonly isLoading = computed(() => this.loading());
  readonly isSummaryLoading = computed(() => this.summaryLoading());

  setQuery(query: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const q = (query || '').trim();
    if (!q) {
      this.results.set([]);
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.doSearch(q);
    }, DEBOUNCE_MS);
  }

  clearResults(): void {
    this.results.set([]);
  }

  async getPageSummary(title: string): Promise<WikiPageSummary | null> {
    const slug = encodeURIComponent(title.replaceAll(' ', '_'));
    const cached = this.getSummaryCached(slug);
    if (cached) return cached;

    this.summaryLoading.set(true);
    try {
      const res = await fetch(`${SUMMARY_BASE}${slug}`);
      if (!res.ok) return null;
      const data = await res.json();
      const summary: WikiPageSummary = {
        title: data.title ?? title,
        description: data.description,
        thumbnail: data.thumbnail,
        originalimage: data.originalimage,
      };
      this.setSummaryCached(slug, summary);
      return summary;
    } catch {
      return null;
    } finally {
      this.summaryLoading.set(false);
    }
  }

  private async doSearch(query: string): Promise<void> {
    const cached = this.getSearchCached(query);
    if (cached) {
      this.results.set(cached);
      return;
    }

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    this.loading.set(true);

    try {
      const url = `${SEARCH_API}&srsearch=${encodeURIComponent(query)}`;
      const res = await fetch(url, { signal: this.abortController.signal });
      const data = await res.json();

      const list = data?.query?.search;
      if (!Array.isArray(list)) {
        this.results.set([]);
        return;
      }

      const items: WikiSearchResult[] = list.map((p: { title: string; pageid: number }) => ({
        pageid: p.pageid,
        title: p.title,
      }));

      this.setSearchCached(query, items);
      this.results.set(items);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      this.results.set([]);
    } finally {
      this.loading.set(false);
      this.abortController = null;
    }
  }

  private getSearchCached(query: string): WikiSearchResult[] | null {
    const key = query.toLowerCase().trim();
    const entry = this.searchCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.at > CACHE_MAX_AGE_MS) {
      this.searchCache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setSearchCached(query: string, data: WikiSearchResult[]): void {
    this.searchCache.set(query.toLowerCase().trim(), { data, at: Date.now() });
  }

  private getSummaryCached(slug: string): WikiPageSummary | null {
    const entry = this.summaryCache.get(slug);
    if (!entry) return null;
    if (Date.now() - entry.at > CACHE_MAX_AGE_MS) {
      this.summaryCache.delete(slug);
      return null;
    }
    return entry.data;
  }

  private setSummaryCached(slug: string, data: WikiPageSummary): void {
    this.summaryCache.set(slug, { data, at: Date.now() });
  }
}
