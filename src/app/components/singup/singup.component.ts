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
import { environment } from '../../../environments/environment.prod';

// login component
import { LoginComponent } from '../login/login.component';

@Component({
  selector: 'app-singup',
  imports: [
            CommonModule, RouterModule, ReactiveFormsModule, HttpClientModule
          ],
  templateUrl: './singup.component.html',
  styleUrl: './singup.component.scss'
})
export class SingupComponent {
  formSingup!: FormGroup;

  errorMessage: string = '';
  passwordFieldType: string = 'password';
  confirmPass: string = 'confirmPass';

  constructor(
    private router: Router,
    private businessService: BusinessService,
    private authService: AuthService,
    private loginComponent: LoginComponent,
    private http: HttpClient,
    private fb: FormBuilder,
  ) {
    this.formSingup = this.fb.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
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
        // await this.loginComponent.login(undefined, signupData.email, signupData.password);
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
