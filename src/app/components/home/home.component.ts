import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BusinessService } from '../../services/business/business.service';
@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  standalone: true
})
export class HomeComponent {

  constructor(
    private route: ActivatedRoute,
    private businessService: BusinessService,
  ) {}


  ngOnInit() {
    console.log('Home');
  }

}
