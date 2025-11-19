import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface DialogData {
  userId: number;
  userName: string;
  cardType: 'points' | 'strips';
  currentValue: number;
  maxStrips?: number;
}

@Component({
  selector: 'app-add-points-strips',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>
        {{ data.cardType === 'points' ? 'Agregar Puntos' : 'Agregar Strip' }}
      </h2>

      <div class="user-info">
        <div class="info-item">
          <span class="label">Usuario:</span>
          <span class="value">{{ data.userName }}</span>
        </div>
        <div class="info-item">
          <span class="label">{{ data.cardType === 'points' ? 'Puntos actuales:' : 'Strips actuales:' }}</span>
          <span class="value">
            {{ data.currentValue }}<ng-container *ngIf="data.cardType === 'strips' && data.maxStrips"> / {{ data.maxStrips }}</ng-container>
          </span>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label>
            {{ data.cardType === 'points' ? 'Cantidad de puntos a agregar' : 'Cantidad de strips a agregar' }}
          </label>
          <input
            type="number"
            formControlName="amount"
            [min]="1"
            [max]="data.cardType === 'strips' && data.maxStrips ? (data.maxStrips - data.currentValue) : null"
            class="form-control"
          />
          <div class="error" *ngIf="form.get('amount')?.invalid && form.get('amount')?.touched">
            <span *ngIf="form.get('amount')?.errors?.['required']">Este campo es requerido</span>
            <span *ngIf="form.get('amount')?.errors?.['min']">El mínimo es 1</span>
            <span *ngIf="form.get('amount')?.errors?.['max']">
              No puedes agregar más de {{ (data.maxStrips || 0) - data.currentValue }} strips
            </span>
          </div>
        </div>

        <div class="preview" *ngIf="form.get('amount')?.valid">
          <span class="preview-label">Nuevo total:</span>
          <span class="preview-value">
            {{ data.currentValue + (form.get('amount')?.value || 0) }}
            <ng-container *ngIf="data.cardType === 'strips' && data.maxStrips">
              / {{ data.maxStrips }}
            </ng-container>
          </span>
        </div>

        <div class="dialog-actions">
          <button type="button" class="btn" (click)="onCancel()">Cancelar</button>
          <button type="submit" class="btn primary" [disabled]="form.invalid || isLoading">
            {{ isLoading ? 'Procesando...' : 'Agregar' }}
          </button>
        </div>

        <div class="error-message" *ngIf="errorMessage">
          {{ errorMessage }}
        </div>
      </form>
    </div>
  `,
  styles: [`
    .dialog-container {
      padding: 20px;
      min-width: 400px;
    }

    h2 {
      margin: 0 0 20px 0;
      color: #1f2937;
      font-size: 20px;
      font-weight: 600;
    }

    .user-info {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: grid;
      gap: 8px;
    }

    .info-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .label {
      color: #6b7280;
      font-size: 14px;
    }

    .value {
      color: #1f2937;
      font-weight: 600;
      font-size: 14px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: #374151;
      font-weight: 500;
      font-size: 14px;
    }

    .form-control {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s;
    }

    .form-control:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .error {
      color: #dc2626;
      font-size: 12px;
      margin-top: 4px;
    }

    .preview {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .preview-label {
      color: #1e40af;
      font-size: 14px;
      font-weight: 500;
    }

    .preview-value {
      color: #1e40af;
      font-size: 18px;
      font-weight: 700;
    }

    .dialog-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .btn {
      padding: 10px 20px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      background: white;
      transition: all 0.2s;
    }

    .btn:hover {
      background: #f9fafb;
    }

    .btn.primary {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
    }

    .btn.primary:hover:not(:disabled) {
      background: #2563eb;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .error-message {
      background: #fee2e2;
      color: #dc2626;
      padding: 12px;
      border-radius: 8px;
      margin-top: 16px;
      font-size: 14px;
    }

    @media (max-width: 480px) {
      .dialog-container {
        min-width: 300px;
        padding: 16px;
      }
    }
  `]
})
export class AddPointsStripsComponent implements OnInit {
  form!: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private dialogRef: MatDialogRef<AddPointsStripsComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {}

  ngOnInit() {
    const maxValue = this.data.cardType === 'strips' && this.data.maxStrips
      ? this.data.maxStrips - this.data.currentValue
      : 999999;

    const validators = [Validators.required, Validators.min(1)];

    if (maxValue < 999999) {
      validators.push(Validators.max(maxValue));
    }

    this.form = this.fb.group({
      amount: [1, validators]
    });
  }

  async onSubmit() {
    if (this.form.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const amount = this.form.get('amount')?.value;

      if (this.data.cardType === 'points') {
        // Agregar puntos
        await this.http.post(`${environment.urlApi}/users/${this.data.userId}/points`, {
          points: amount
        }).toPromise();
      } else {
        // Agregar strips
        await this.http.post(`${environment.urlApi}/users/${this.data.userId}/strips`, {
          strips: amount
        }).toPromise();
      }

      this.dialogRef.close({ success: true, amount });
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Error al agregar ' + (this.data.cardType === 'points' ? 'puntos' : 'strips');
      console.error('Error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onCancel() {
    this.dialogRef.close({ success: false });
  }
}
