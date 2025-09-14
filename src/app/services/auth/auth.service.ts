import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, from, Observable } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment  } from '../../../environments/environment';

const helper = new JwtHelperService();
const TOKEN_KEY = 'jwt-token';  // Usamos el almacenamiento local del navegador

export type SessionUser = {
  sub?: string;
  email?: string;
  username?: string;
  role?: 'admin' | 'user' | string;
  business_id?: number | string;
  id?: number | string;
  isAdmin?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userDataSubject = new BehaviorSubject<SessionUser|null>(null);
  user$ = this.userDataSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  isAuth$ = this.isAuthenticatedSubject.asObservable();

  // opcional: espejo de “businessData” que te da el backend
  private businessDataSubject = new BehaviorSubject<any>(null);
  business$ = this.businessDataSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadStoredToken();  // Cargar token almacenado al iniciar
  }

   // Verificar si el usuario está autenticado
  isAuthenticated(): boolean | string | null {
    const token = localStorage.getItem(TOKEN_KEY);
    return token && !helper.isTokenExpired(token);  // Verifica si el token no está expirado
  }

  // Cargar el token guardado y decodificarlo
  loadStoredToken() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && !helper.isTokenExpired(token)) {
      const decoded = helper.decodeToken(token);
      this.userDataSubject.next(decoded);  // Almacena los datos del usuario
      this.isAuthenticatedSubject.next(true);  // El usuario está autenticado
    } else {
      localStorage.removeItem(TOKEN_KEY); // Limpia el token expirado
      this.isAuthenticatedSubject.next(false);
    }
  }

  setSessionFromToken(token: string, businessData?: any) {
    localStorage.setItem(TOKEN_KEY, token);
    const decoded = helper.decodeToken(token) as SessionUser;
    this.userDataSubject.next(decoded);
    this.isAuthenticatedSubject.next(true);
    if (businessData) this.businessDataSubject.next(businessData);
  }

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    this.userDataSubject.next(null);
    this.businessDataSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  getSnapshot() { return this.userDataSubject.value; }
  getRole(): string|undefined {
    const u = this.userDataSubject.value;
    return (u?.role || (u as any)?.['role'] || (u as any)?.['https://claims/role']);
  }
  getBusinessId(): string|number|undefined {
    const u = this.userDataSubject.value;
    const b = this.businessDataSubject.value;
    return u?.business_id ?? u?.id ?? b?.business_id ?? b?.id;
  }

  async login(email: string, password: string): Promise<any> {
    try {
      const response = await this.http.post<any>(
        `${environment.urlApi}/business/loginBusiness`,
        { email, password },
        { headers: new HttpHeaders({ 'Content-Type': 'application/json' }), withCredentials: true }
      ).toPromise();

      if (response?.success && response?.token) {
        this.setSessionFromToken(response.token, response.data);
        return { success: true, data: response.data, token: response.token };
      }
      return { success: false, message: response?.message || 'Credenciales incorrectas' };
    } catch {
      return { success: false, message: 'Error al conectar con el servidor' };
    }
  }

  async logout() {
    this.clearSession();
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
