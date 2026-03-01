import { Routes } from '@angular/router';
import { PageComponent } from './page/page.component';
import { AuthCallbackComponent } from './components/auth/auth.component';

export const routes: Routes = [
  { path: '', component: PageComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
];
