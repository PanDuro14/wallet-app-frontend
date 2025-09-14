import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// formularios
import {
  AbstractControl, FormArray, FormBuilder, FormGroup,
  ReactiveFormsModule, Validators, ValidationErrors
} from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

// material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule }      from '@angular/material/input';
import { MatIconModule }       from '@angular/material/icon';
import { MatButtonModule }     from '@angular/material/button';
import { MatSelectModule }     from '@angular/material/select';
import { MatCheckboxModule }   from '@angular/material/checkbox';

type KVItem = {
  key: 'pass_type_id' | 'terms' | string;
  value: string | string[];
  type: 'text' | 'file';
  enabled: boolean;
};

@Component({
  selector: 'app-create-desing',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule, HttpClientModule,
    MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule,
    MatSelectModule, MatCheckboxModule
  ],
  templateUrl: './create-desing.component.html',
  styleUrls: ['./create-desing.component.scss']
})
export class CreateDesingComponent implements OnInit {
  @Input() businessId!: number;
  @Output() createdDesing = new EventEmitter<{designId:number}>();

  private fb   = inject(FormBuilder);
  private http = inject(HttpClient);

  form!: FormGroup;
  busy = false;
  createdId: number | null = null;
  errorMessage = '';

  formats = ['qr', 'pdf417', 'aztec', 'code128'];

  ngOnInit(): void {
    this.form = this.fb.group({
      businessId: [{value: this.businessId ?? 1 }],
      programName: ['', [Validators.required, Validators.maxLength(100)]],
      // colores
      background: ['#074f63', [this.hexColorValidator]],
      foreground: ['#E6E6E6', [this.hexColorValidator]],
      label:      ['#FFFFFF',  [this.hexColorValidatorOptional]],

      // flags
      disableStrip: [true],
      disableLogo:  [false],
      hideAccount:  [true],
      hideProgramName: [false],

      // barcode
      primary:  ['pdf417', Validators.required],
      message:  ['{{cardCode}}'],
      altText:  ['{{cardCode}}'],
      encoding: ['iso-8859-1'],
      additional: this.fb.array<string>([]),

      pass_type_id: ['Loyalty Pass'],
      terms: ['', [Validators.maxLength(5000)]],
    });
  }

  ngOnChanges(){
    if(this.form && this.businessId){
      this.form.get('businessId')?.setValue(this.businessId);
    }
  }

  fc(name: string): AbstractControl { return this.form.get(name)!; }
  additionalFA(): FormArray { return this.form.get('additional') as FormArray; }

  // Valida #RGB/#RGBA/#RRGGBB/#RRGGBBAA
  hexColorValidator = (c: AbstractControl): ValidationErrors | null => {
    const v = (c.value ?? '').toString().trim();
    if (!v) return { required: true };
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) ? null : { hex: true };
  };
  hexColorValidatorOptional = (c: AbstractControl): ValidationErrors | null => {
    const v = (c.value ?? '').toString().trim();
    if (!v) return null;
    return this.hexColorValidator(c);
  };

  normalizeHexTo6(v?: string): string | undefined {
    if (!v) return undefined;
    const s0 = v.trim();
    if (!s0) return undefined;
    if (!s0.startsWith('#')) return s0; // por si mandan rgb(...)
    let s = s0.slice(1);
    if (s.length === 8) s = s.slice(0,6); // ignora alfa
    if (s.length === 4) s = s.slice(0,3);
    if (s.length === 3) s = s.split('').map(ch => ch+ch).join('');
    if (s.length !== 6) return '#000000';
    return '#' + s.toLowerCase();
  }

  buildPayload() {
    const v = this.form.value as any;
    const payload: any = {
      businessId: Number(v.businessId),
      programName: (v.programName || '').trim(),
      colors: {
        background: this.normalizeHexTo6(v.background),
        foreground: this.normalizeHexTo6(v.foreground),
        ...(v.label ? { label: this.normalizeHexTo6(v.label) } : {})
      },
      assets: {
        ...(v.disableStrip ? { disableStrip: true } : {}),
        ...(v.disableLogo  ? { disableLogo: true }  : {})
      },
      hideAccount: !!v.hideAccount,
      hideProgramName: !!v.hideProgramName,
      barcode: {
        primary: v.primary,
        message: v.message || '{{cardCode}}',
        altText: v.altText || '{{cardCode}}',
        encoding: v.encoding || 'iso-8859-1',
        additional: (v.additional || []).filter((x: string) => !!x && x !== v.primary)
      }
    };
    return payload;
  }

  async onSubmit() {
    this.errorMessage = '';
    this.createdId = null;
    if (this.form.invalid) return;

    const payload = this.buildPayload();
    payload.businessId = Number(this.businessId);

    // normaliza label si vino mal
    if (payload.colors?.label && !/^#[0-9a-f]{6}$/i.test(payload.colors.label)) {
      payload.colors.label = this.normalizeHexTo6(payload.colors.label);
    }

    this.busy = true;
    try {
      // 1) Crear diseño (vive en design_json)
      const createUrl = `${environment.urlApi}/cards/unified`;
      const res: any = await this.http.post(createUrl, payload).toPromise();
      const designId = Number(res?.id || res?.design?.id || res?.data?.id || 0);
      if (!designId) throw new Error('No se recibió id de diseño');

      // 2) PATCH SOLO pass_type_id y terms (columnas), sin tocar imágenes
      const passType = (this.fc('pass_type_id').value || '').trim();
      const terms    = (this.fc('terms').value || '').trim();

      if (passType || terms) {
        const body: any = {};
        if (passType) body.pass_type_id = passType;
        if (terms)    body.terms        = terms;

        await this.http.patch(
          `${environment.urlApi}/cards/meta/${designId}`,
          body
          // si quieres reforzar ownership:
          // { ...body, business_id: this.businessId }
        ).toPromise();
      }

      // 3) Emitir evento al caller
      this.createdId = designId;
      this.createdDesing.emit({ designId });

    } catch (e: any) {
      this.errorMessage = e?.error?.error || e?.message || 'Error al crear diseño';
    } finally {
      this.busy = false;
    }
  }




  reset() {
    this.form.reset({
      businessId: 1,
      programName: '',
      background: '#074f63',
      foreground: '#E6E6E6',
      label: '#FFFFFF',
      disableStrip: true,
      disableLogo: false,
      hideAccount: true,
      hideProgramName: false,
      primary: 'pdf417',
      message: '{{cardCode}}',
      altText: '{{cardCode}}',
      encoding: 'iso-8859-1',
      additional: [],
      terms: ''
    });
    this.additionalFA().clear();
  }

  // Convierte el valor del form a #RRGGBB para el <input type="color">
  colorForPicker(control: string): string {
    const v = this.fc(control).value as string;
    const hex = this.normalizeHexTo6(v || '#000000')!;
    // type=color solo entiende #RRGGBB
    return /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000';
  }

  // Sincroniza cuando el <input type="color"> cambia
  syncFromPicker(control: string, ev: Event) {
    const val = (ev.target as HTMLInputElement).value || '#000000';
    this.fc(control).setValue(this.normalizeHexTo6(val), { emitEvent: true });
  }

  // Corrige el hex al salir del input de texto
  fixHex(control: string, optional = false) {
    const raw = (this.fc(control).value ?? '').toString().trim();
    if (!raw && optional) return; // si es opcional, permite vacío
    const fixed = this.normalizeHexTo6(raw || '#000000');
    this.fc(control).setValue(fixed, { emitEvent: true });
  }

  // EyeDropper API (gotero) con fallback
  async pickWithEyedropper(control: string) {
    const anyWin = window as any;
    if (anyWin.EyeDropper) {
      try {
        const ed = new anyWin.EyeDropper();
        const res = await ed.open();
        this.fc(control).setValue(this.normalizeHexTo6(res.sRGBHex), { emitEvent: true });
      } catch {
        /* usuario canceló */
      }
    } else {
      // Fallback: abre el color input “invisible” si quieres,
      // o solo informa que no está soportado.
      alert('Tu navegador no soporta el gotero. Usa el selector de color.');
    }
  }

  // Chips de formatos adicionales
  isAdditional(f: string): boolean {
    const arr = (this.form.get('additional') as any).value as string[];
    return arr?.includes(f);
  }

  toggleAdditional(f: string) {
    const arr = this.form.get('additional') as any;
    const val: string[] = arr.value || [];
    const i = val.indexOf(f);
    if (i >= 0) val.splice(i, 1);
    else if (f !== this.fc('primary').value) val.push(f);
    arr.setValue([...val]);
  }

}
