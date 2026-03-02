import { Component, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../supabase.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-auth',
  standalone: true,
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
  imports: [FormsModule],
})
export class AuthComponent {
  private supabaseService = inject(SupabaseService);

  email = signal('');
  password = signal('');
  message = signal('');
  user = this.supabaseService.user;
  authReady = this.supabaseService.authReady;

  async login() {
    this.message.set('');
    const { data, error } = await this.supabaseService.signIn(this.email(), this.password());

    if (error) {
      this.message.set(error.message);
    } else if (data?.user) {
      this.user.set(data.user);
      this.message.set('Login successful!');
    }
  }

  async register() {
    this.message.set('');
    const { data, error } = await this.supabaseService.signUp(this.email(), this.password());

    if (error) {
      this.message.set(error.message);
    } else if (!data.session) {
      this.message.set(
        'An account with this email may already exist or requires confirmation. Please check your inbox.',
      );
    } else {
      this.message.set('Registration successful! You are now logged in.');
      this.user.set(data.user);
    }
  }

  async logout() {
    await this.supabaseService.signOut();
    this.user.set(null);
    this.message.set('');
  }
}
