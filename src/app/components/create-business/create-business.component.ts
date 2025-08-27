import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// formularios
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// fechas
import { DatePipe } from '@angular/common';

// Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-create-business',
  standalone: true,
  imports: [ CommonModule, RouterModule, ReactiveFormsModule, HttpClientModule, MatFormFieldModule,
    MatInputModule, MatIconModule, MatButtonModule

  ],
  providers: [ DatePipe ],
  templateUrl: './create-business.component.html',
  styleUrls: ['./create-business.component.scss']
})
export class CreateBusinessComponent implements OnInit{
  @Output() createdBusiness = new EventEmitter<void>();
  formCreateBusiness!: FormGroup;

  errorMessage: string = '';
  passwordFieldType: 'password' | 'text' = 'password';
  confirmFieldType: 'password' | 'text' = 'password';
  confirmPass: string = 'confirmPass';

  showPassword = false;
  previewImage: string | ArrayBuffer | null = null;
  selectedFile: File | null = null;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private datePipe: DatePipe,
  ){
    this.formCreateBusiness = this.fb.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        // al menos 1 mayúscula y 1 número (como tenías)
        Validators.pattern(/^(?=.*[A-Z])(?=.*\d).*$/)
      ]],
      confirmPass: ['', [Validators.required, this.confirmPassValidator.bind(this)]],
      logo: [null,  [
        this.fileRequired(),
        this.fileType(['image/png','image/jpeg','image/webp']),
        this.fileMaxSize(160 * 1024 * 1024)
      ]],
      created_at: [''],
      updated_at: [''],
    });
  }

  ngOnInit(): void {
    // si cambia la contraseña, forzar revalidar la confirmación
    this.formCreateBusiness.get('password')?.valueChanges.subscribe(() => {
      this.formCreateBusiness.get('confirmPass')?.updateValueAndValidity({ onlySelf: true });
    });
  }

  // --- Mensajes de error (corrige minlength -> sin typo) ---
  getErrorMessage(controlName: string){
    const control = this.formCreateBusiness?.get(controlName);
    if(!control) return '';
    if(control.hasError('required')) return 'Campo requerido';
    if(control.hasError('email')) return 'Correo electrónico inválido';
    if(control.hasError('minlength')) return 'Debe tener al menos 8 caracteres';
    if(control.hasError('pattern')) return 'Debe incluir al menos una mayúscula y un número';
    if(control.hasError('fileType')) return 'Solo PNG, JPG/JPEG o WEBP';
    if(control.hasError('fileMaxSize')) return 'Tamaño máximo 16MB';
    if(controlName === 'confirmPass' && control.hasError('passwordMismatch')) return 'Las contraseñas no coinciden';
    return '';
  }

  // --- Validadores de archivo ---
  fileRequired() {
    return (c: AbstractControl) => (c.value ? null : { required: true });
  }

  fileType(allowed: string[]) {
    return (c: AbstractControl) => {
      const v = c.value;
      const f: File | null = v instanceof File ? v : (v instanceof FileList ? v.item(0) : null);
      if (!f) return null;
      return allowed.includes(f.type) ? null : { fileType: true };
    };
  }

  fileMaxSize(max: number) {
    return (c: AbstractControl) => {
      const v = c.value;
      const f: File | null = v instanceof File ? v : (v instanceof FileList ? v.item(0) : null);
      if (!f) return null;
      return f.size <= max ? null : { fileMaxSize: { max, actual: f.size } };
    };
  }

  // --- Confirmación de contraseña (tu validador) ---
  confirmPassValidator(control: AbstractControl): {[key: string]: boolean} | null {
    if( !this.formCreateBusiness || !this.formCreateBusiness.get('password')){
      return null;
    }
    const password = this.formCreateBusiness.get('password')?.value;
    const confirmPass = control.value;

    if(password !== confirmPass){
      return {'passwordMismatch': true}
    } else {
      if(this.formCreateBusiness.get('password')?.hasError('confirmPassFalse')){
        this.formCreateBusiness.get('password')?.setErrors(null);
      }
    }
    return null;
  }

  // --- Fecha opcional ---
  getCurrentDate(){
    try {
      const currentDate = new Date();
      const currentDateFormat = this.datePipe.transform(currentDate, 'dd/MM/yyyy');
      return currentDateFormat
    } catch (error) {
      throw error;
    }
  }

  touchedInvalid(controlName: string): boolean {
    const c = this.formCreateBusiness.get(controlName);
    return !!(c && c.invalid && (c.touched || c.dirty));
  }


  // --- File input: guarda en logo y preview ---
  onFileChange(event: any){
    const file: File | undefined = event?.target?.files?.[0];
    if (!file) {
      this.formCreateBusiness.get('logo')?.setValue(null);
      return;
    }

    // preview base64
    const reader = new FileReader();
    reader.onload = () => { this.previewImage = reader.result; };
    reader.readAsDataURL(file);

    // setea el File en el control (como NO está enlazado al input, no rompe)
    this.formCreateBusiness.get('logo')?.setValue(file);
    this.formCreateBusiness.get('logo')?.markAsTouched();
    this.formCreateBusiness.get('logo')?.markAsDirty();
    this.formCreateBusiness.get('logo')?.updateValueAndValidity();

    console.log('[logo]', { size: file.size, type: file.type });
  }



  // --- Toggle de contraseña (usa passwordFieldType) ---
  togglePassword(): void {
    this.passwordFieldType = this.passwordFieldType === 'password' ? 'text' : 'password';
  }


  toggleConfirmPassVisibility(): void {
    this.confirmFieldType = this.confirmFieldType === 'password' ? 'text' : 'password';
  }

  // --- Submit ---
  async createBusiness(event?: Event){
    if(event) event.preventDefault();

    if(this.formCreateBusiness.invalid){
      this.formCreateBusiness.markAllAsTouched();
      this.errorMessage = 'Por favor, completa todos los campos correctamente';
      return;
    }

    // setear timestamps si los necesitas
    this.formCreateBusiness.get('created_at')?.setValue(new Date().toISOString());
    this.formCreateBusiness.get('updated_at')?.setValue(new Date().toISOString());

    try {
      // Enviar como FormData para mandar el archivo real
      const fd = new FormData();
      fd.append('name', this.formCreateBusiness.get('name')?.value);
      fd.append('email', this.formCreateBusiness.get('email')?.value);
      fd.append('password', this.formCreateBusiness.get('password')?.value);
      const file = this.formCreateBusiness.get('logo')?.value as File | null;
      if (file) fd.append('logo', file);
      fd.append('created_at', this.formCreateBusiness.get('created_at')?.value);
      fd.append('updated_at', this.formCreateBusiness.get('updated_at')?.value);

      const response = await this.http.post<any>(`${environment.urlApi}/business`, fd).toPromise();

      if( response && (response.success ?? true) ){
        this.createdBusiness.emit(); // cierra modal / notifica padre
      } else {
        this.errorMessage = response?.message || 'No se pudo registrar el negocio';
      }
    } catch (error) {
      console.error(error);
      this.errorMessage = 'Error al contectar con el servidor';
    }

  }
  ngOnDestroy() {
    if (this.previewImage) return this.previewImage = null;
    return;
  }


}
