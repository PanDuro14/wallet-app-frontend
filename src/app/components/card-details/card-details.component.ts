import { Component, EventEmitter, OnInit, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

import { DatePipe } from '@angular/common';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

type KVItem = {
  key: 'pass_type_id' | 'terms' | string;
  value: string | string[];
  type: 'text' | 'file';
  enabled: boolean;
};

@Component({
  selector: 'app-card-details',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule, HttpClientModule,
    MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule
  ],
  providers: [ DatePipe ],
  templateUrl: './card-details.component.html',
  styleUrls: ['./card-details.component.scss']   // <- OJO: plural
})
export class CardDetailsComponent {
  @Input({ required: true }) designId!: number;
  @Input({ required: true }) businessId!: number;   // <- necesario para fallback multipart
  @Input() kv?: KVItem[];
  @Input() fetchKvEndpoint?: string;                // si quieres cargar el KV desde aquí
  @Input() autoApply = true;

  @Output() updated = new EventEmitter<void>();

  form: FormGroup;
  busy = false;
  errorMessage = '';
  infoMessage = '';

  constructor(private http: HttpClient, private fb: FormBuilder) {
    this.form = this.fb.group({
      pass_type_id: [''],
      terms: ['', [Validators.maxLength(5000)]],
    });
  }

  // --- helpers ---
  private kvToTermsAndPass(kv: KVItem[]) {
    const get = (k: string) => kv.find(x => x.key === k && x.enabled)?.value as string | undefined;
    const partial: { pass_type_id?: string; terms?: string } = {};
    const passTypeId = get('pass_type_id');
    const terms      = get('terms');
    if (typeof passTypeId === 'string' && passTypeId.trim()) partial.pass_type_id = passTypeId.trim();
    if (typeof terms === 'string' && terms.trim())           partial.terms        = terms.trim();
    return partial;
  }

  /** Update robusto: primero PUT JSON a /cards/unified/:id; si falla, fallback a PUT multipart /cards/:id */
  private async updateTermsPass(partial: { terms?: string; pass_type_id?: string }) {
    const clean: any = {};
    if (partial.pass_type_id) clean.pass_type_id = partial.pass_type_id;
    if (partial.terms)        clean.terms        = partial.terms;
    if (!Object.keys(clean).length) return;

    // intento A: JSON
    try {
      await firstValueFrom(
        this.http.put(`${environment.urlApi}/cards/unified/${this.designId}`, clean)
      );
      return;
    } catch (e1) {
      // sigue al fallback
    }

    // intento B: multipart/form-data (requiere business_id)
    if (!this.businessId) {
      throw new Error('businessId es requerido para actualizar via /cards/:id (multipart).');
    }
    const fd = new FormData();
    fd.set('business_id', String(this.businessId));
    if (clean.pass_type_id) fd.set('pass_type_id', clean.pass_type_id);
    if (clean.terms)        fd.set('terms', clean.terms);

    await firstValueFrom(
      this.http.put(`${environment.urlApi}/cards/${this.designId}`, fd)
    );
  }

  private async fetchKv(): Promise<KVItem[]> {
    if (this.kv) return this.kv;
    if (!this.fetchKvEndpoint) {
      throw new Error('No se definió fetchKvEndpoint ni se pasó kv: no hay de dónde sacar los términos.');
    }
    return await firstValueFrom(this.http.get<KVItem[]>(this.fetchKvEndpoint));
  }

  // --- acciones ---
  async applyFromKv() {
    this.errorMessage = ''; this.infoMessage = ''; this.busy = true;
    try {
      const kv = await this.fetchKv();
      const partial = this.kvToTermsAndPass(kv);
      await this.updateTermsPass(partial);
      this.infoMessage = 'Términos y pass_type_id aplicados.';
      this.updated.emit();
    } catch (e: any) {
      this.errorMessage = e?.error?.message || e?.message || 'No se pudo aplicar desde KV';
    } finally {
      this.busy = false;
    }
  }

  async applyFromForm() {
    this.errorMessage = ''; this.infoMessage = ''; this.busy = true;
    try {
      const raw = this.form.value as { pass_type_id?: string; terms?: string };
      const partial: any = {};
      if (raw.pass_type_id?.trim()) partial.pass_type_id = raw.pass_type_id.trim();
      if (raw.terms?.trim())        partial.terms        = raw.terms.trim();

      await this.updateTermsPass(partial);
      this.infoMessage = 'Actualizado correctamente.';
      this.updated.emit();
    } catch (e: any) {
      this.errorMessage = e?.error?.message || e?.message || 'No se pudo actualizar';
    } finally {
      this.busy = false;
    }
  }
}
