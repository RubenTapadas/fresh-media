import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Entry } from '../media/media.model';
import { CardComponent } from '../components/card/card.component';
import { SupabaseService } from '../../supabase.service';
import { FilterService } from '../services/filter.service';
import {
  WikipediaSearchService,
  WikiSearchResult,
} from '../services/wikipedia-search.service';

interface GroupedEntry {
  month: string;
  year: number;
  entries: Entry[];
  yearChanged?: boolean;
  monthTypeCount?: { [key: string]: number };
  yearTypeCount?: { [key: string]: number };
}

@Component({
  selector: 'app-page',
  standalone: true,
  templateUrl: './page.component.html',
  styleUrls: ['./page.component.scss'],
  imports: [CommonModule, RouterModule, FormsModule, CardComponent],
})
export class PageComponent implements OnInit {
  private filterService = inject(FilterService);
  private supabaseService = inject(SupabaseService);
  wikiSearch = inject(WikipediaSearchService);

  authReady = signal(false);
  user = this.supabaseService.user;

  entries = signal<Entry[]>([]);
  filteredEntries = computed<Entry[]>(() => {
    const entries = this.entries();
    const searchType = this.filterService.searchType();
    const searchString = this.filterService.searchString();

    return entries.filter((e) => {
      if (searchType && e.type !== searchType) return false;
      if (searchString && !e.title.toLowerCase().includes(searchString.toLowerCase())) return false;
      return true;
    });
  });

  selected = signal<Partial<Entry> | null>(null);
  showPanel = signal(false);

  planned = computed<Entry[]>(() => this.filteredEntries().filter((e) => !e.completed_date));
  groupedCompleted = computed<GroupedEntry[]>(() => {
    const all = this.filteredEntries();
    const completed = all.filter((e) => e.completed_date);
    completed.sort(
      (a, b) => new Date(b.completed_date!).getTime() - new Date(a.completed_date!).getTime(),
    );

    const groups: { [key: string]: Entry[] } = {};
    for (const entry of completed) {
      const date = new Date(entry.completed_date!);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    }

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const grouped: GroupedEntry[] = Object.keys(groups).map((key, index) => {
      const [year, month] = key.split('-');
      const currentYear = parseInt(year);
      const prevYear = index > 0 ? parseInt(Object.keys(groups)[index - 1].split('-')[0]) : null;
      const yearChanged = prevYear !== currentYear;
      return {
        month: monthNames[parseInt(month)],
        year: currentYear,
        entries: groups[key],
        yearChanged,
        monthTypeCount: groups[key].reduce(
          (acc, entry) => {
            if (!acc[entry.type as any]) acc[entry.type as any] = 0;
            acc[entry.type as any] += 1;
            return acc;
          },
          {} as { [key: string]: number },
        ),
        yearTypeCount: completed.reduce(
          (acc, entry) => {
            const entryYear = new Date(entry.completed_date!).getFullYear();
            if (entryYear !== currentYear) return acc;
            if (!acc[entry.type as any]) acc[entry.type as any] = 0;
            acc[entry.type as any] += 1;
            return acc;
          },
          {} as { [key: string]: number },
        ),
      };
    });

    return grouped;
  });

  constructor() {
    effect(() => {
      if (this.user() && !this.loadCollection()) {
        this.loadCollection();
      }
    });

    effect(() => {
      if (!this.user()) {
        this.selected.set(null);
        this.showPanel.set(false);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    this.authReady.set(this.supabaseService.authReady());
  }

  async loadCollection(): Promise<void> {
    const data = await this.supabaseService.getUserCollection();
    this.entries.set(data);
  }

  async updateEntry(entry: Entry): Promise<void> {
    let result: Entry | null;

    if (!entry.id) {
      result = await this.supabaseService.addEntry(entry);
      if (result) {
        this.entries.update((list) => [...list, result!]);
      }
    } else {
      result = await this.supabaseService.updateEntry(entry);
      if (result) {
        this.entries.update((list) => list.map((e) => (e.id === result!.id ? result! : e)));
      }
    }

    this.clearPanel();
  }

  async actionDelete(id?: number): Promise<void> {
    if (!id) return;

    const success = await this.supabaseService.deleteEntry(id);

    if (success) {
      this.entries.update((list) => list.filter((e) => e.id !== id));
    }

    this.clearPanel();
  }

  actionComplete(id?: number): void {
    if (id) {
      const entry = this.entries().find((e) => e.id === id);
      if (entry) this.updateEntry({ ...entry, completed_date: new Date().toISOString() });
    }
  }

  actionUncomplete(id?: number): void {
    if (id) {
      const entry = this.entries().find((e) => e.id === id);
      if (entry) this.updateEntry({ ...entry, completed_date: '' });
    }
  }

  updateSelected(field: string, value: string | number): void {
    if (field === 'score') {
      const numericValue = Number(value);
      if (isNaN(numericValue) || numericValue < 0) value = 0;
      else if (numericValue > 10) value = 10;
      else value = Math.round(numericValue * 10) / 10;
    }

    this.selected.update((s) => (s ? { ...s, [field]: value } : s));

    if (field === 'title' && typeof value === 'string') {
      this.wikiSearch.setQuery(value);
    }
  }

  onTitleSearchBlur(): void {
    setTimeout(() => this.wikiSearch.clearResults(), 150);
  }

  async selectWikiResult(result: WikiSearchResult): Promise<void> {
    const summary = await this.wikiSearch.getPageSummary(result.title);
    this.wikiSearch.clearResults();
    if (!summary) return;
    const imageUrl =
      summary.thumbnail?.source ?? summary.originalimage?.source ?? undefined;
    this.selected.update((s) =>
      s
        ? {
            ...s,
            title: summary.title,
            image_url: imageUrl ?? s.image_url,
          }
        : s,
    );
  }

  actionEdit(): void {
    if (this.selected()) {
      this.updateEntry(this.selected() as Entry);
    }
  }

  actionCancel(): void {
    this.clearPanel();
  }

  clearPanel(): void {
    this.showPanel.set(false);
    this.wikiSearch.clearResults();
    setTimeout(() => this.selected.set(null), 300);
  }

  actionEpisodeStep(step: number, id?: number): void {
    if (id) {
      const entry = this.entries().find((e) => e.id === id);
      if (entry) {
        const current_episode = entry.current_episode ? entry.current_episode + step : step;
        const completed_date =
          entry.total_episodes === current_episode ? new Date().toISOString() : '';
        this.updateEntry({ ...entry, current_episode, completed_date });
      }
    }
  }
}
