import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../supabase.service';

@Component({
  selector: 'app-auth-callback',
  templateUrl: './auth.component.html',
})
export class AuthCallbackComponent implements OnInit {
  constructor(
    private supabase: SupabaseService,
    private router: Router,
  ) {}

  async ngOnInit() {
    // Parse the OAuth redirect and restore session
    await this.supabase.initializeAuth();
    this.router.navigate(['/']); // go to main page
  }
}
