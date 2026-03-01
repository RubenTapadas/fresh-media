import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { environment } from './environments/environment';
import { Entry } from './app/media/media.model';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private supabase: SupabaseClient;

  user = signal<User | null>(null); // current user
  authReady = signal(false); // session restored

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    this.initializeAuth();
  }

  async initializeAuth() {
    // Restore session from localStorage and parse URL if coming from OAuth redirect
    const { data } = await this.supabase.auth.getSession();
    this.user.set(data.session?.user ?? null);

    // Listen for future changes
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.user.set(session?.user ?? null);
    });

    this.authReady.set(true);
  }

  async signUp(email: string, password: string) {
    return this.supabase.auth.signUp({ email, password });
  }

  async signIn(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    await this.supabase.auth.signOut();
    this.user.set(null);
  }

  async getCurrentUser(): Promise<User | null> {
    return this.user();
  }

  async loginWithGoogle() {
    return this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback', // matches your Angular callback route
      },
    });
  }

  async getUserCollection(): Promise<Entry[]> {
    const user = await this.getCurrentUser();
    if (!user) return [];

    const { data, error } = await this.supabase
      .from('entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] getUserCollection:', error);
      return [];
    }

    return (data ?? []) as Entry[];
  }

  async addEntry(entry: Entry): Promise<Entry | null> {
    const user = await this.getCurrentUser();
    if (!user) return null;

    this.entryFormater(entry);

    const { data, error } = await this.supabase
      .from('entries')
      .insert([{ ...entry, user_id: user.id }])
      .select()
      .single();

    if (error) {
      console.error('[Supabase] addEntry:', error);
      return null;
    }

    return data as Entry;
  }

  async updateEntry(entry: Entry): Promise<Entry | null> {
    const user = await this.getCurrentUser();
    if (!user || !entry.id) return null;

    this.entryFormater(entry);

    const { data, error } = await this.supabase
      .from('entries')
      .update(entry)
      .eq('id', entry.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      return null;
    }

    return data as Entry;
  }

  async deleteEntry(id: number): Promise<boolean> {
    const user = await this.getCurrentUser();
    if (!user) return false;

    const { error } = await this.supabase
      .from('entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error(error);
      return false;
    }

    return true;
  }

  private entryFormater(entry: Entry) {
    if (!entry.type) entry.type = 'movie';
    if (entry.completed_date === '') (entry.completed_date as any) = null;
    if (entry.current_episode === null) entry.current_episode = 0;
    if (entry.total_episodes === null) entry.total_episodes = 1;
    if ((entry.total_episodes as number) > 3000) entry.total_episodes = 3000;
    if ((entry.total_episodes as number) < (entry.current_episode as number))
      entry.current_episode = entry.total_episodes;

    return entry;
  }
}
