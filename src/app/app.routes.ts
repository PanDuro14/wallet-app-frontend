import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { UserComponent } from './components/user/user.component';
import { ClosePageComponent } from './components/close-page/close-page.component';
import { BusinessPageComponent } from './components/business-page/business-page.component';
import { DesingsPageComponent } from './components/desings-page/desings-page.component';

export const routes: Routes = [
  {
    path: 'home',
    component: HomeComponent
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'dashboard',
    component: DashboardComponent
  },
  {
    path:'registro',
    component: UserComponent
  },
  {
    path: 'finish-register/:id',
    component: ClosePageComponent
  },
  {
    path: 'business/:id',
    component: BusinessPageComponent
  },
  {
    path: 'desings/:id',
    component: DesingsPageComponent
  }
];
