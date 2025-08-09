import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';

// Servicios
import { BusinessService } from '../../services/business/business.service';
import { AuthService } from '../../services/auth/auth.service';

// formularios
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpClientModule  } from '@angular/common/http';
import { environment } from '../../../environments/environment.prod';


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

  constructor(
    private router: Router,
    private businessService: BusinessService,
    private authService: AuthService,
    private http: HttpClient,
    private fb: FormBuilder,
  ) {
    this.formSingup = this.fb.group({
      name: ['', Validators.required],
      email: ['', Validators.required, Validators.email],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[A-Z])(?=.*\d).*$/)
      ]],
      logoBuffer: [null],
      created_at: ['fecha actual xd'],
      updated_at: ['sin modificar'],
      confirmPass: ['', [Validators.required, this.confirmPasswordValidators.bind(this)]]
    });

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
      console.error('No se pudo inicializar la sesión');
      return;
    }
  }

  // Obtener la información del sharedViewModel (servicio)
  getBusinessData(){
    return this.businessService.getBusinessData();
  }

  // Login
  // Dentro de LoginComponent
  async login(event?: Event, email?: string, password?: string) {
    if (event) event.preventDefault();

    // Si no se pasan como argumentos, tomar del formulario
    const emailLogin = email || this.formLogin.get('emailLogin')?.value;
    const passwordLogin = password || this.formLogin.get('passwordLogin')?.value;

    if (!emailLogin || !passwordLogin) {
      this.errorMessage = 'Por favor ingresa correo y contraseña';
      return;
    }

    try {
      const result = await this.authService.login(emailLogin, passwordLogin);

      if (result.success) {
        // Guardar datos en BusinessService
        const businessData = result.data; // Ajusta según lo que devuelva tu backend
        this.businessService.setBusinessData(businessData);

        // Guardar el ID si existe
        if (businessData.id) {
          this.businessService.setBusinessId(businessData.id);
        }

        // Inicializar sesión actual
        await this.initCurrentSesion(emailLogin);

        // Marcar como autenticado
        this.businessService.setAuthenticated(true);

        // Redirigir
        this.router.navigate(['/dashboard']);
      } else {
        this.errorMessage = result.message;
        this.failedLoginAttemps++;
      }
    } catch (err) {
      console.error(err);
      this.errorMessage = 'Error al iniciar sesión. Inténtalo más tarde.';
    }
  }

  // Singup
  async signup(event?: Event) {
    if (event) event.preventDefault();

    if (this.formSingup.invalid) {
      this.errorMessage = 'Por favor completa todos los campos correctamente';
      return;
    }

    const signupData = {
      name: this.formSingup.get('name')?.value,
      email: this.formSingup.get('email')?.value,
      password: this.formSingup.get('password')?.value,
      logoBuffer: this.formSingup.get('logoBuffer')?.value,
      created_at: new Date().toISOString(),
      updated_at: null
    };

    try {
      const response = await this.http.post<any>(
        `${environment.urlApi}/business`,
        signupData
      ).toPromise();

      if (response && response.success) {
        // Opcional: login automático después de registrarse
        await this.login(undefined, signupData.email, signupData.password);
      } else {
        this.errorMessage = response.message || 'No se pudo registrar el negocio';
      }
    } catch (error) {
      console.error(error);
      this.errorMessage = 'Error al conectar con el servidor';
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
