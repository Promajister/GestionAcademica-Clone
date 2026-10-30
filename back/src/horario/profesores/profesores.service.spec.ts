import { Test, TestingModule } from '@nestjs/testing';
import { ProfesoresService } from './profesores.service';

describe('ProfesoresService', () => {
  let service: ProfesoresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProfesoresService],
    }).compile();

    service = module.get<ProfesoresService>(ProfesoresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
