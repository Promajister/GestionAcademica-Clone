import { Test, TestingModule } from '@nestjs/testing';
import { ProfesoresController } from './profesores.controller';
import { ProfesoresService } from './profesores.service';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CsrfGuard } from '../../auth/guards/csrf.guard';

describe('ProfesoresController', () => {
  let controller: ProfesoresController;

  beforeEach(async () => {
    const permitir = { canActivate: () => true };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfesoresController],
      providers: [{ provide: ProfesoresService, useValue: {} }],
    })
      .overrideGuard(JwtCookieAuthGuard)
      .useValue(permitir)
      .overrideGuard(RolesGuard)
      .useValue(permitir)
      .overrideGuard(CsrfGuard)
      .useValue(permitir)
      .compile();

    controller = module.get<ProfesoresController>(ProfesoresController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
