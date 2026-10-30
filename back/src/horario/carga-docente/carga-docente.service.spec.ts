import { Test, TestingModule } from '@nestjs/testing';
import { CargaDocenteService } from './carga-docente.service';

describe('CargaDocenteService', () => {
  let service: CargaDocenteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CargaDocenteService],
    }).compile();

    service = module.get<CargaDocenteService>(CargaDocenteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
