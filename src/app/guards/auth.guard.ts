// src/app/guards/auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';  // Accede al servicio AuthService

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.authService.isAuthenticated()) {  // Verifica si el usuario está autenticado
      return true;  // Permite el acceso
    } else {
      this.router.navigate(['/login']);  // Redirige al login si no está autenticado
      return false;  // Bloquea el acceso
    }
  }
}
