// src/app/services/language.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LanguagesService {
  private currentLang = new BehaviorSubject<string>('es');
  currentLang$ = this.currentLang.asObservable();

  constructor() {
    this.initLanguage();
  }

  private initLanguage(): void {
    const savedLang = localStorage.getItem('preferredLanguage');
    const browserLang = navigator.language.split('-')[0];
    const supportedLangs = ['es', 'en'];

    let langToUse = savedLang || browserLang;

    if (!supportedLangs.includes(langToUse)) {
      langToUse = 'es';
    }

    this.currentLang.next(langToUse);
  }

  setLanguage(lang: string): void {
    this.currentLang.next(lang);
    localStorage.setItem('preferredLanguage', lang);
    window.location.reload();
  }

  getCurrentLanguage(): string {
    return this.currentLang.value;
  }
}
