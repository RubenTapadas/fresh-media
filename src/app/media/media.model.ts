export interface Entry {
  id?: number;
  title: string;
  type?: 'movie' | 'series' | 'book' | 'game';
  image_url?: string;
  completed_date?: string;
  score?: number; // 0-10 rating
  current_episode?: number;
  total_episodes?: number;
}
