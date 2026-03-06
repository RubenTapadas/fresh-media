import { Injectable, signal } from '@angular/core';
import { EntryType } from '../media/media.model';

@Injectable({ providedIn: 'root' })
export class FilterService {
  searchString = signal('');
  searchType = signal<EntryType | null>(null);
}
