// create-desing.component.ts

import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import {
  AbstractControl, FormArray, FormBuilder, FormGroup,
  ReactiveFormsModule, Validators, ValidationErrors
} from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule }      from '@angular/material/input';
import { MatIconModule }       from '@angular/material/icon';
import { MatButtonModule }     from '@angular/material/button';
import { MatSelectModule }     from '@angular/material/select';
import { MatCheckboxModule }   from '@angular/material/checkbox';
import { MatRadioModule }      from '@angular/material/radio'; // ✅ NUEVO

type CardType = 'points' | 'strips';
type RewardMode = 'single' | 'multi-tier'; // ✅ NUEVO

@Component({
  selector: 'app-create-desing',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule, HttpClientModule,
    MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule,
    MatSelectModule, MatCheckboxModule, MatRadioModule // ✅ NUEVO
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
  stripLayouts = ['horizontal', 'vertical'];

  sectionsExpanded = {
    colors: true,
    flags: false,
    strips: true,
    fields: false,
    barcode: false,
    terms: false
  };

  ngOnInit(): void {
    this.form = this.fb.group({
      cardType: ['points', Validators.required],

      businessId: [{value: this.businessId ?? 1 }],
      programName: ['', [Validators.required, Validators.maxLength(100)]],

      background: ['#074f63', [this.hexColorValidator]],
      foreground: ['#E6E6E6', [this.hexColorValidator]],
      label:      ['#FFFFFF',  [this.hexColorValidatorOptional]],

      disableStrip: [true],
      disableLogo:  [false],
      hideAccount:  [true],
      hideProgramName: [false],

      primary:  ['pdf417', Validators.required],
      message:  ['{{cardCode}}'],
      altText:  ['{{cardCode}}'],
      encoding: ['iso-8859-1'],
      additional: this.fb.array<string>([]),

      // ✅ NUEVO: Modo de recompensas
      rewardMode: ['single'], // 'single' o 'multi-tier'

      // Campos para SINGLE reward
      stripsTotal: [8, [Validators.min(2), Validators.max(20)]],
      stripsLayout: ['horizontal'],
      stripsRewardTitle: [''],
      stripsRewardDescription: [''], // ✅ NUEVO

      // ✅ NUEVO: Array de recompensas multi-tier
      rewards: this.fb.array([]),

      primaryFields: this.fb.array([]),
      secondaryFields: this.fb.array([]),
      backFields: this.fb.array([]),

      pass_type_id: ['Loyalty Pass'],
      terms: ['', [Validators.maxLength(5000)]],
    });

    // Escuchar cambios en cardType
    this.form.get('cardType')?.valueChanges.subscribe((type: CardType) => {
      this.updateValidatorsByCardType(type);
      this.adjustFieldsByCardType(type);
    });

    // ✅ NUEVO: Escuchar cambios en rewardMode
    this.form.get('rewardMode')?.valueChanges.subscribe((mode: RewardMode) => {
      this.updateValidatorsByRewardMode(mode);
    });

    this.initializeStripsDefaults();
  }

  ngOnChanges(){
    if(this.form && this.businessId){
      this.form.get('businessId')?.setValue(this.businessId);
    }
  }

  fc(name: string): AbstractControl { return this.form.get(name)!; }
  additionalFA(): FormArray { return this.form.get('additional') as FormArray; }
  primaryFieldsFA(): FormArray { return this.form.get('primaryFields') as FormArray; }
  secondaryFieldsFA(): FormArray { return this.form.get('secondaryFields') as FormArray; }
  backFieldsFA(): FormArray { return this.form.get('backFields') as FormArray; }
  rewardsFA(): FormArray { return this.form.get('rewards') as FormArray; } // ✅ NUEVO

  get isStripsMode(): boolean {
    return this.form.get('cardType')?.value === 'strips';
  }

  // ✅ NUEVO
  get isMultiTierMode(): boolean {
    return this.form.get('rewardMode')?.value === 'multi-tier';
  }

  initializeStripsDefaults() {
    this.primaryFieldsFA().push(this.createFieldGroup({
      key: 'progress',
      label: 'PROGRESO',
      value: ' '
    }));

    this.secondaryFieldsFA().push(this.createFieldGroup({
      key: 'member',
      label: 'MEMBER',
      value: '{userName}'
    }));

    this.backFieldsFA().push(this.createFieldGroup({
      key: 'reward',
      label: 'PREMIO',
      value: '{rewardTitle}'
    }));
    this.backFieldsFA().push(this.createFieldGroup({
      key: 'status',
      label: 'ESTADO',
      value: '{isComplete ? \'COMPLETO\' : \'EN PROGRESO\'}'
    }));
    this.backFieldsFA().push(this.createFieldGroup({
      key: 'instructions',
      label: 'INSTRUCCIONES',
      value: 'Presenta esta tarjeta en cada compra para coleccionar strips'
    }));
  }

  createFieldGroup(data: {key: string, label: string, value: string}): FormGroup {
    return this.fb.group({
      key: [data.key, Validators.required],
      label: [data.label, Validators.required],
      value: [data.value, Validators.required]
    });
  }

  // ✅ NUEVO: Crear grupo para recompensa multi-tier
  createRewardGroup(data?: {title: string, description?: string, strips_required: number}): FormGroup {
    return this.fb.group({
      title: [data?.title || '', [Validators.required, Validators.maxLength(100)]],
      description: [data?.description || '', Validators.maxLength(200)],
      strips_required: [data?.strips_required || 5, [Validators.required, Validators.min(1), Validators.max(20)]]
    });
  }

  // ✅ NUEVO: Agregar recompensa al array
  addReward() {
    this.rewardsFA().push(this.createRewardGroup());
  }

  // ✅ NUEVO: Remover recompensa
  removeReward(index: number) {
    this.rewardsFA().removeAt(index);
  }

  // ✅ NUEVO: Inicializar con 3 recompensas por defecto
  initializeDefaultRewards() {
    this.rewardsFA().clear();
    this.rewardsFA().push(this.createRewardGroup({
      title: 'Premio Nivel 1',
      description: 'Completa 5 visitas',
      strips_required: 5
    }));
    this.rewardsFA().push(this.createRewardGroup({
      title: 'Premio Nivel 2',
      description: 'Completa 5 visitas más',
      strips_required: 5
    }));
    this.rewardsFA().push(this.createRewardGroup({
      title: 'Premio Nivel 3',
      description: 'Completa 5 visitas más',
      strips_required: 5
    }));
  }

  addField(type: 'primary' | 'secondary' | 'back') {
    const arrayMap = {
      primary: this.primaryFieldsFA(),
      secondary: this.secondaryFieldsFA(),
      back: this.backFieldsFA()
    };

    arrayMap[type].push(this.createFieldGroup({
      key: '',
      label: '',
      value: ''
    }));
  }

  removeField(type: 'primary' | 'secondary' | 'back', index: number) {
    const arrayMap = {
      primary: this.primaryFieldsFA(),
      secondary: this.secondaryFieldsFA(),
      back: this.backFieldsFA()
    };

    arrayMap[type].removeAt(index);
  }

  updateValidatorsByCardType(type: CardType) {
    const stripsTotal = this.form.get('stripsTotal');
    const stripsRewardTitle = this.form.get('stripsRewardTitle');
    const message = this.form.get('message');
    const disableStrip = this.form.get('disableStrip');

    if (type === 'strips') {
      stripsTotal?.setValidators([Validators.required, Validators.min(2), Validators.max(20)]);
      stripsRewardTitle?.setValidators([Validators.required, Validators.maxLength(100)]);
      message?.clearValidators();
      disableStrip?.setValue(false);
    } else {
      stripsTotal?.clearValidators();
      stripsRewardTitle?.clearValidators();
      disableStrip?.setValue(true);
    }

    stripsTotal?.updateValueAndValidity();
    stripsRewardTitle?.updateValueAndValidity();
    message?.updateValueAndValidity();
  }

  // ✅ NUEVO: Actualizar validaciones según modo de recompensa
  updateValidatorsByRewardMode(mode: RewardMode) {
    const stripsTotal = this.form.get('stripsTotal');
    const stripsRewardTitle = this.form.get('stripsRewardTitle');

    if (mode === 'multi-tier') {
      // En multi-tier, los campos single no son requeridos
      stripsTotal?.clearValidators();
      stripsRewardTitle?.clearValidators();

      // Inicializar rewards si está vacío
      if (this.rewardsFA().length === 0) {
        this.initializeDefaultRewards();
      }
    } else {
      // En single, restaurar validaciones
      stripsTotal?.setValidators([Validators.required, Validators.min(2), Validators.max(20)]);
      stripsRewardTitle?.setValidators([Validators.required, Validators.maxLength(100)]);
    }

    stripsTotal?.updateValueAndValidity();
    stripsRewardTitle?.updateValueAndValidity();
  }

  adjustFieldsByCardType(type: CardType) {
    if (type === 'points') {
      this.primaryFieldsFA().clear();
      this.secondaryFieldsFA().clear();
      this.backFieldsFA().clear();
    } else {
      if (this.primaryFieldsFA().length === 0 &&
          this.secondaryFieldsFA().length === 0 &&
          this.backFieldsFA().length === 0) {
        this.initializeStripsDefaults();
      }
    }
  }

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
    if (!s0.startsWith('#')) return s0;
    let s = s0.slice(1);
    if (s.length === 8) s = s.slice(0,6);
    if (s.length === 4) s = s.slice(0,3);
    if (s.length === 3) s = s.split('').map(ch => ch+ch).join('');
    if (s.length !== 6) return '#000000';
    return '#' + s.toLowerCase();
  }

  buildPayload() {
    const v = this.form.value as any;
    const cardType = v.cardType as CardType;
    const rewardMode = v.rewardMode as RewardMode;

    const basePayload: any = {
      businessId: Number(v.businessId),
      programName: (v.programName || '').trim(),
      colors: {
        background: this.normalizeHexTo6(v.background),
        foreground: this.normalizeHexTo6(v.foreground),
        ...(v.label ? { label: this.normalizeHexTo6(v.label) } : {})
      },
      assets: {
        ...(v.disableStrip ? { disableStrip: true } : { disableStrip: false }),
        ...(v.disableLogo  ? { disableLogo: true }  : {})
      },
      hideAccount: !!v.hideAccount,
      hideProgramName: !!v.hideProgramName,
      barcode: {
        primary: v.primary
      }
    };

    if (cardType === 'strips') {
      basePayload.cardType = 'strips';

      // ✅ NUEVO: Decidir entre single o multi-tier
      if (rewardMode === 'multi-tier') {
        // Multi-tier: array de recompensas
        basePayload.strips = {
          layout: v.stripsLayout || 'horizontal',
          rewards: (v.rewards || []).map((r: any) => ({
            title: r.title.trim(),
            description: r.description?.trim() || '',
            strips_required: Number(r.strips_required)
          }))
        };
      } else {
        // Single: una sola recompensa
        basePayload.strips = {
          total: Number(v.stripsTotal) || 8,
          layout: v.stripsLayout || 'horizontal',
          rewardTitle: (v.stripsRewardTitle || '').trim(),
          rewardDescription: (v.stripsRewardDescription || '').trim()
        };
      }

      basePayload.fields = {
        primary: this.buildFieldsArray(v.primaryFields),
        secondary: this.buildFieldsArray(v.secondaryFields),
        back: this.buildFieldsArray(v.backFields)
      };

    } else {
      basePayload.barcode = {
        primary: v.primary,
        message: v.message || '{{cardCode}}',
        altText: v.altText || '{{cardCode}}',
        encoding: v.encoding || 'iso-8859-1',
        additional: (v.additional || []).filter((x: string) => !!x && x !== v.primary)
      };
    }

    return basePayload;
  }

  buildFieldsArray(fields: any[]): any[] {
    if (!fields || !Array.isArray(fields)) return [];
    return fields
      .filter(f => f.key && f.label)
      .map(f => ({
        key: f.key.trim(),
        label: f.label.trim(),
        value: f.value.trim()
      }));
  }

  async onSubmit() {
    this.errorMessage = '';
    this.createdId = null;

    // ✅ VALIDACIÓN ADICIONAL PARA MULTI-TIER
    if (this.isStripsMode && this.isMultiTierMode) {
      if (this.rewardsFA().length === 0) {
        this.errorMessage = 'Debes agregar al menos una recompensa';
        return;
      }
    }

    if (this.form.invalid) {
      this.errorMessage = 'Por favor completa todos los campos requeridos';
      return;
    }

    const payload = this.buildPayload();
    payload.businessId = Number(this.businessId);

    if (payload.colors?.label && !/^#[0-9a-f]{6}$/i.test(payload.colors.label)) {
      payload.colors.label = this.normalizeHexTo6(payload.colors.label);
    }

    this.busy = true;
    try {
      const createUrl = `${environment.urlApi}/cards/unified`;
      const res: any = await this.http.post(createUrl, payload).toPromise();
      const designId = Number(res?.id || res?.design?.id || res?.data?.id || 0);
      if (!designId) throw new Error('No se recibió id de diseño');

      const passType = (this.fc('pass_type_id').value || '').trim();
      const terms    = (this.fc('terms').value || '').trim();

      if (passType || terms) {
        const body: any = {};
        if (passType) body.pass_type_id = passType;
        if (terms)    body.terms        = terms;

        await this.http.patch(
          `${environment.urlApi}/cards/meta/${designId}`,
          body
        ).toPromise();
      }

      this.createdId = designId;
      this.createdDesing.emit({ designId });

    } catch (e: any) {
      this.errorMessage = e?.error?.error || e?.message || 'Error al crear diseño';
    } finally {
      this.busy = false;
    }
  }

  reset() {
    const cardType = this.form.get('cardType')?.value || 'points';

    this.form.reset({
      cardType: cardType,
      businessId: this.businessId || 1,
      programName: '',
      background: '#074f63',
      foreground: '#E6E6E6',
      label: '#FFFFFF',
      disableStrip: cardType === 'points',
      disableLogo: false,
      hideAccount: true,
      hideProgramName: false,
      primary: 'pdf417',
      message: '{{cardCode}}',
      altText: '{{cardCode}}',
      encoding: 'iso-8859-1',
      rewardMode: 'single', // ✅ NUEVO
      stripsTotal: 8,
      stripsLayout: 'horizontal',
      stripsRewardTitle: '',
      stripsRewardDescription: '', // ✅ NUEVO
      pass_type_id: 'Loyalty Pass',
      terms: ''
    });

    this.additionalFA().clear();
    this.primaryFieldsFA().clear();
    this.secondaryFieldsFA().clear();
    this.backFieldsFA().clear();
    this.rewardsFA().clear(); // ✅ NUEVO

    if (cardType === 'strips') {
      this.initializeStripsDefaults();
    }
  }

  colorForPicker(control: string): string {
    const v = this.fc(control).value as string;
    const hex = this.normalizeHexTo6(v || '#000000')!;
    return /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000';
  }

  syncFromPicker(control: string, ev: Event) {
    const val = (ev.target as HTMLInputElement).value || '#000000';
    this.fc(control).setValue(this.normalizeHexTo6(val), { emitEvent: true });
  }

  fixHex(control: string, optional = false) {
    const raw = (this.fc(control).value ?? '').toString().trim();
    if (!raw && optional) return;
    const fixed = this.normalizeHexTo6(raw || '#000000');
    this.fc(control).setValue(fixed, { emitEvent: true });
  }

  async pickWithEyedropper(control: string) {
    const anyWin = window as any;
    if (anyWin.EyeDropper) {
      try {
        const ed = new anyWin.EyeDropper();
        const res = await ed.open();
        this.fc(control).setValue(this.normalizeHexTo6(res.sRGBHex), { emitEvent: true });
      } catch {}
    } else {
      alert('Tu navegador no soporta el gotero. Usa el selector de color.');
    }
  }

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

  get totalStripsRequired(): number {
    if (!this.isMultiTierMode) return 0;

    return this.rewardsFA().controls.reduce((sum, ctrl) => {
      const value = ctrl.get('strips_required')?.value || 0;
      return sum + Number(value);
    }, 0);
  }

  get totalLevels(): number {
    return this.rewardsFA().length;
  }
}
