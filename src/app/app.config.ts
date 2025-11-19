import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { LanguagesService } from './services/languages/languages.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    // Proveedor global de locale
    {
      provide: LOCALE_ID,
      useFactory: (langService: LanguagesService) => langService.getCurrentLanguage(),
      deps: [LanguagesService]
    }
  ]
};

// ng build --configuration production
// firebase deploy --only hosting
