import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';

export interface RegisterPayload {
  name: string;
  email: string;
  phone?: string;
  business_id: number;
}

export interface WalletDTO {
  google_save_url?: string;
  apple_pkpass_url?: string;
  apple_auth_header?: string;
}

export interface UserDTO {
  id: number;
  name: string;
  email: string;
  phone?: string;
  business_id?: number;
  serial_number?: string;
  apple_auth_token?: string;
  apple_pass_type_id?: string;
  card_detail_id?: number;
  loyalty_account_id?: string;
}

export interface RegisterResponse {
  message?: string;
  user: UserDTO;
  wallet?: WalletDTO;             // <- AQUI
  walletUrl?: string | null;      // si alguna ruta antigua aún lo usa
  walletStatus?: 'PENDING';
}

export interface WalletRequest {
  cardCode: string;
  userName: string;
  programName: string;
  businessId: number;
}
export interface WalletResponse {
  url: string;
}


@Injectable({
  providedIn: 'root'
})

// Propiedad de Jesús Emmanuel Morales Ruvalcaba
export class UserService {
  private base = environment.urlApi;
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private userDataSubject = new BehaviorSubject<any>(null);
  private userSesionSubject = new BehaviorSubject<any>(null);
  private userIdGlobalSubject = new BehaviorSubject<any>(null);

  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  userData$ = this.userDataSubject.asObservable();
  userSesion$ = this.userSesionSubject.asObservable();
  userIdGlobal$ = this.userIdGlobalSubject.asObservable();

  constructor(private http: HttpClient ) {
    this.initializeUserSesion();
  }

  register(payload: RegisterPayload) {
    return this.http.post<RegisterResponse>(`${this.base}/onboarding/users`, payload);
  }

  // Crear un link de una tarjeta
  createWalletLink(body: WalletRequest){
    return this.http.post<WalletResponse>(`${environment.urlApi}/wallets/google`, body);
  }

   // opcional: reintentar emitir tarjeta si quedó pendiente
  retryWallet(userId: number) {
    return this.http.post<{ walletUrl: string }>(`${this.base}/users/${userId}/wallet`, {});
  }

  private initializeUserSesion(){
    const storedUserData = localStorage.getItem('userData');
    const storedSesionData = localStorage.getItem('currentSesion');
    const storedUserId = localStorage.getItem('userIdGlobal');
    const isAuthenticated = storedSesionData && storedUserData && storedUserId ?  true : false;

    if(storedUserData){
      this.userDataSubject.next(JSON.parse(storedUserData));
    }
    if(storedSesionData){
      this.userSesionSubject.next(JSON.parse(storedSesionData));
    }
    if(storedUserId){
      this.userIdGlobalSubject.next(JSON.parse(storedUserId));
    }
    this.isAuthenticatedSubject.next(isAuthenticated);
  }

  setUserData(data: any): void {
    this.userDataSubject.next(data);
    localStorage.setItem('userData', JSON.stringify(data));
  }

  setCurrentSesion(data: any): void{
    this.userSesionSubject.next(data);
    localStorage.setItem('currentSesion', JSON.stringify(data));
  }

  setUserId(id: number): void{
    this.userIdGlobalSubject.next(id);
    localStorage.setItem('userIdGlobal', JSON.stringify(id))
  }

  getUserId(){
    return this.userIdGlobalSubject.value;
  }

  getUserData(){
    return this.userDataSubject.value;
  }

  getCurrentSesion(){
    return this.userSesionSubject.value;
  }

  setAuthenticated(isAuthenticated: boolean){
    this.isAuthenticatedSubject.next(isAuthenticated);
  }

}
