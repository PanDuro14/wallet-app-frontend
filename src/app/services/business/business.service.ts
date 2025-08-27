import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { map } from 'rxjs/operators';
export interface Business {
  id: number,
  name: string,
  slug?: string | null;
}

@Injectable({
  providedIn: 'root'
})

// Propiedad de Jesús Emmanuel Morales Ruvalcaba
export class BusinessService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private businessDataSubject = new BehaviorSubject<any>(null);
  private businessSesionSubject = new BehaviorSubject<any>(null);
  private businessIdGlobalSubject = new BehaviorSubject<any>(null);

  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  businessData$ = this.businessDataSubject.asObservable();
  businessSesion$ = this.businessSesionSubject.asObservable();
  businessIdGlobal$ = this.businessIdGlobalSubject.asObservable();

  constructor(private http: HttpClient) {
    this.initializeBusinessSesion();
  }

  getAllBusinesses(): Observable<Business[]> {
    const url = `${environment.urlApi}/business`; // o '/business' si tu backend es singular
    return this.http.get<any>(url).pipe(
      map(res => {
        if (Array.isArray(res)) return res;                 // [ ... ]
        if (Array.isArray(res?.data)) return res.data;      // { data: [ ... ] }
        if (Array.isArray(res?.businesses)) return res.businesses; // { businesses: [ ... ] }
        return [];
      })
    );
  }

  // Inicialización de sesión de negocio (cargar datos del localStorage)
  private initializeBusinessSesion() {
    const storedBusinessData = localStorage.getItem('businessData');
    const storedSesionData = localStorage.getItem('currentBusinessSesion');
    const storedBusinessId = localStorage.getItem('businessIdGlobal');

    const safeParse = (value: string | null) => {
      try {
        return value && value !== 'undefined' ? JSON.parse(value) : null;
      } catch {
        return null;
      }
    };

    this.businessDataSubject.next(safeParse(storedBusinessData));
    this.businessSesionSubject.next(safeParse(storedSesionData));
    this.businessIdGlobalSubject.next(safeParse(storedBusinessId));

    const isAuthenticated =
      !!this.businessDataSubject.value &&
      !!this.businessSesionSubject.value &&
      !!this.businessIdGlobalSubject.value;

    this.isAuthenticatedSubject.next(isAuthenticated);
  }


  // Configurar los datos del negocio
  setBusinessData(data: any): void {
    this.businessDataSubject.next(data);
    localStorage.setItem('businessData', JSON.stringify(data));
  }

  // Configurar la sesión actual del negocio
  setCurrentSesion(data: any): void {
    this.businessSesionSubject.next(data);
    localStorage.setItem('currentBusinessSesion', JSON.stringify(data));
  }

  // Configurar el ID global del negocio
  setBusinessId(id: number): void {
    this.businessIdGlobalSubject.next(id);
    localStorage.setItem('businessIdGlobal', JSON.stringify(id));
  }

  // Obtener el ID del negocio
  getBusinessId() {
    return this.businessIdGlobalSubject.value;
  }

  // Obtener los datos del negocio
  getBusinessData() {
    return this.businessDataSubject.value;
  }

  // Obtener la sesión actual del negocio
  getCurrentSesion() {
    return this.businessSesionSubject.value;
  }

  // Establecer si el negocio está autenticado
  setAuthenticated(isAuthenticated: boolean) {
    this.isAuthenticatedSubject.next(isAuthenticated);
  }
}
