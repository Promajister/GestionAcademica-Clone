import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AsignacionCargaComponent } from './asignacion-carga.component';

describe('AsignacionCargaComponent', () => {
  let component: AsignacionCargaComponent;
  let fixture: ComponentFixture<AsignacionCargaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsignacionCargaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AsignacionCargaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
