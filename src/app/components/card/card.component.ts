import { Component, input, output } from '@angular/core';
import { Entry } from '../../media/media.model';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.scss'],
  imports: [DecimalPipe],
})
export class CardComponent {
  info = input<Partial<Entry> | null>();
  hasAction = input(true);

  select = output<void>();
  delete = output<void>();

  complete = output<void>();
  uncomplete = output<void>();
  episodeStep = output<number>();
}
