import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';

// Servicios
import { BusinessService } from '../../services/business/business.service';
import { AuthService } from '../../services/auth/auth.service';

// formularios
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpClientModule  } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Helpers para validar la sesión
const norm = (s?: string) => (s ?? '').trim().toLowerCase();
const toAdminSet = (admins: unknown): Set<string> => {
  if (Array.isArray(admins)) return new Set(admins.map(norm).filter(Boolean));
  const raw = String(admins ?? '');
  return new Set(raw.split(/[,\s;]+/).map(norm).filter(Boolean));
};

@Component({
  selector: 'app-login',
  imports: [
            CommonModule, RouterModule, ReactiveFormsModule, HttpClientModule
          ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  standalone: true
})
export class LoginComponent {
  failedLoginAttemps: number = 0;

  // datos para el login
  allBusinesses: any[] = [];
  businessSesion: any;
  businessData: any;

  formSingup!: FormGroup;
  formLogin!: FormGroup;
  formRecover!: FormGroup;

  errorMessage: string = '';
  passwordFieldType: string = 'password';
  confirmPass: string = 'confirmPass';

  public isAdminUser = false;
  private usersAdmins = {
    email: 'admin'
  }

  loading = false;

  constructor(
    private router: Router,
    private businessService: BusinessService,
    private authService: AuthService,
    private http: HttpClient,
    private fb: FormBuilder,
  ) {

    this.formLogin = this.fb.group({
      emailLogin: ['', [Validators.required, Validators.email]],
      passwordLogin: ['', [Validators.required]]
    });
  }

  ngOnInit() {
    // Ejemplo: Obtener el parámetro 'id' de la ruta
    console.log('Login');
  }


  // Obtener a todos los usuarios
  getBusiness(){
    this.http.get<any>(`${environment.urlApi}/business`).subscribe((data) => {
      this.allBusinesses = data;
    }, (error) => {
      throw error;
    });
  }


  // Obtener un email
 getOneEmail(email: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.http.post<any>(`${environment.urlApi}/business/getemail/`, { email }).subscribe({
        next: (data) => {
          this.businessSesion = (data && data.length > 0) ? data[0] : null;

          if (this.businessSesion && Object.keys(this.businessSesion).length > 0) {
            resolve(this.businessSesion);
          } else {
            // No se encontró el email, resolver con null o rechazar
            resolve(null);
            // o también reject(new Error('No se encontró el email'));
          }
        },
        error: (err) => {
          reject(err);
        }
      });
    });
  }


  // Inicializar la sesión actual
  async initCurrentSesion(email?: string){
    if(!email) {
      email = this.businessService.getBusinessData()?.email || this.formLogin.get('email')?.value;
    }
    if(!email) return;

    try {
      await this.getOneEmail(email);
      const dataSesion = this.businessSesion;
      if(dataSesion){
        this.businessService.setCurrentSesion(dataSesion);
      }
    } catch (error){
      //console.error('No se pudo inicializar la sesión');
      return;
    }
  }

  // Obtener la información del sharedViewModel (servicio)
  getBusinessData(){
    return this.businessService.getBusinessData();
  }

  // Login
  async login(event?: Event, email?: string, password?: string) {
    if (event) event.preventDefault();

    const emailLogin = (email ?? this.formLogin.get('emailLogin')?.value ?? '').trim();
    const passwordLogin = password ?? this.formLogin.get('passwordLogin')?.value;
    if (!emailLogin || !passwordLogin) {
      this.errorMessage = 'Por favor ingresa correo y contraseña';
      return;
    }
    this.loading = true;

    try {
      const result = await this.authService.login(emailLogin, passwordLogin);
      if (!result?.success) {
        this.errorMessage = result?.message ?? 'Credenciales inválidas';
        this.failedLoginAttemps++;
        return;
      }

      const businessData = result.data;
      this.businessService.setBusinessData(businessData);
      if (businessData?.id) this.businessService.setBusinessId(businessData.id);
      this.businessService.setAuthenticated(true);

      // Carga/actualiza sesión para tener email/username/rol confiables
      await this.getOneEmail(emailLogin);
      const sesion = this.businessSesion ?? businessData;

      // ---- VALIDACIÓN ADMIN ROBUSTA ----
      const emailNorm = norm(sesion?.email ?? emailLogin);
      const userNorm  = norm((sesion as any)?.username ?? (businessData as any)?.username);
      const roleNorm  = norm((sesion as any)?.role ?? (businessData as any)?.role);

      const adminSet = toAdminSet(this.usersAdmins);
      adminSet.add('admin');

      const esAdmin =
        // flag/rol desde backend (lo ideal)
        (sesion as any)?.isAdmin === true ||
        (businessData as any)?.isAdmin === true ||
        roleNorm === 'admin' ||
        // match por identificadores
        adminSet.has(emailNorm) ||
        (!!userNorm && adminSet.has(userNorm));

      if (esAdmin) {
        this.isAdminUser = true;
        await this.router.navigate(['/dashboard'], { replaceUrl: true });
        return;
      }

      // No admin → a su business/:id
      const id = sesion?.business_id ?? sesion?.id ?? businessData?.business_id ?? businessData?.id;
      if (id == null) {
        this.errorMessage = 'No se pudo obtener el ID del negocio para redirigir.';
        return;
      }
      await this.router.navigate(['/business', String(id)], { replaceUrl: true });

    } catch (err) {
      console.error(err);
      this.errorMessage = 'Error al iniciar sesión. Inténtalo más tarde.';
    } finally {
      this.loading = false;
    }
  }


  // Validaciones de errores
  getErrorMessage(controlName: string){
    const control = this.formSingup?.get(controlName);
    if(!control) return '';
    if(control.hasError('required')) return 'Campo requerido';
    if(control.hasError('email')) return 'Correo electrónico inválido';
    if(control.hasError('minlenght')) return 'Debe tener al menos 8 caracteres';
    if(control.hasError('pattern')) return 'Debe incluir al menos una mayúscula';
    return '';
  }

  // Validaciones para las contraseñas
  confirmPasswordValidators(control: AbstractControl): {[key: string]: boolean} | null {
    if ( !this.formSingup || !this.formSingup.get('password')){
      return null;
    }

    const password = this.formSingup.get('password')?.value;
    const confirmPass = control.value;

    if(password !== confirmPass){
      return { 'passwordMismatch': true}
    } else {
      if (this.formSingup.get('password')?.hasError('confirmPassFalse')){
        this.formSingup.get('password')?.setErrors(null);
      }
    }
    return null;
  }



}
