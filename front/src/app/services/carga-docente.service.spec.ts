import { TestBed } from '@angular/core/testing';

import { CargaDocenteService } from './carga-docente.service';

describe('CargaDocenteService', () => {
  let service: CargaDocenteService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CargaDocenteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
