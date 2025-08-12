import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, from, Observable } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment  } from '../../../environments/environment.prod';

const helper = new JwtHelperService();
const TOKEN_KEY = 'jwt-token';  // Usamos el almacenamiento local del navegador

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userDataSubject = new BehaviorSubject<any>(null);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadStoredToken();  // Cargar token almacenado al iniciar
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

  // Función de login
  async login(email: string, password: string): Promise<any> {
    try {
      const response = await this.http.post<any>(`${environment.urlApi}/business/loginBusiness`, { email, password },
        {
          headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
          withCredentials: true
        }).toPromise();

      if (response && response.success) {
        const token = response.token;
        if (token) {
          localStorage.setItem(TOKEN_KEY, token);  // Almacena el token en el almacenamiento local
          const decoded = helper.decodeToken(token);  // Decodifica el token
          this.userDataSubject.next(decoded);  // Guarda los datos del usuario
          this.isAuthenticatedSubject.next(true);  // El usuario está autenticado
          //console.log('Token xd: ', token);
          return { success: true, data: response.data || [], token };

        } else {
          return { success: false, message: 'Token no recibido' };
        }
      } else {
        return { success: false, message: response.message || 'Credenciales incorrectas' };
      }
    } catch (error) {
      return { success: false, message: 'Error al conectar con el servidor' };
    }
  }

  // Función de logout
  async logout() {
    try {
      localStorage.removeItem(TOKEN_KEY);  // Elimina el token del almacenamiento local
      this.userDataSubject.next(null);  // Limpia los datos del usuario
      this.isAuthenticatedSubject.next(false);  // El usuario no está autenticado
      this.router.navigate(['/login'], { replaceUrl: true });  // Redirige a la página de login
    } catch (error) {
      throw error;
    }
  }


  // Verificar si el usuario está autenticado
  isAuthenticated(): Observable<boolean> {
    return this.isAuthenticatedSubject.asObservable();
  }

  // Verificar si el token no ha expirado
  async isLoggedIn(): Promise<boolean> {
    const token = localStorage.getItem(TOKEN_KEY);
    return !!token && !helper.isTokenExpired(token);
  }

  // Restablecer la contraseña
  async resetPassword(email: string) {
    try {
      await this.http.post(`${environment.urlApi}/reset`, { email }).toPromise();
    } catch (error) {
      throw error;
    }
  }
}
