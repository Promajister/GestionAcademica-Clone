import { Test, TestingModule } from '@nestjs/testing';
import { CargaDocenteController } from './carga-docente.controller';
import { CargaDocenteService } from './carga-docente.service';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CsrfGuard } from '../../auth/guards/csrf.guard';

describe('CargaDocenteController', () => {
  let controller: CargaDocenteController;

  beforeEach(async () => {
    const permitir = { canActivate: () => true };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CargaDocenteController],
      providers: [{ provide: CargaDocenteService, useValue: {} }],
    })
      .overrideGuard(JwtCookieAuthGuard)
      .useValue(permitir)
      .overrideGuard(RolesGuard)
      .useValue(permitir)
      .overrideGuard(CsrfGuard)
      .useValue(permitir)
      .compile();

    controller = module.get<CargaDocenteController>(CargaDocenteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
