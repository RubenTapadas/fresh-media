import { Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from '../supabase.service';
import { AuthComponent } from './components/auth/auth.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AuthComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('fresh-media');
  protected supabaseService = inject(SupabaseService);
  protected readonly user = this.supabaseService.user;

  message = signal<string>('');

  signOut() {
    this.supabaseService.signOut();
  }

  async loginWithGoogle() {
    this.message.set(''); // clear previous
    const { data, error } = await this.supabaseService.loginWithGoogle();

    if (error) {
      this.message.set(error.message);
    } else {
      this.message.set('Redirecting to Google login...');
    }
  }
}
