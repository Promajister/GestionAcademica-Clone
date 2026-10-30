import { Test, TestingModule } from '@nestjs/testing';
import { CargaDocenteController } from './carga-docente.controller';

describe('CargaDocenteController', () => {
  let controller: CargaDocenteController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CargaDocenteController],
    }).compile();

    controller = module.get<CargaDocenteController>(CargaDocenteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
