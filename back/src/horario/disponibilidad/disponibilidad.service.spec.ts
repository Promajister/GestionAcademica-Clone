import { ForbiddenException } from '@nestjs/common';
import { DisponibilidadService } from './disponibilidad.service';

describe('DisponibilidadService - HOR-13 CA2', () => {
  const prismaMock = {
    profesor: {
      findUnique: jest.fn(),
    },
    disponibilidad: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    dia: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const profesoresServiceMock = {
    validarDisponibilidad: jest.fn(),
  };

  let service: DisponibilidadService;

  beforeEach(() => {
    jest.resetAllMocks();

    service = new DisponibilidadService(
      prismaMock as any,
      profesoresServiceMock as any,
    );
  });

  it('CA2: impide guardar disponibilidad a docentes no habilitados', async () => {
    profesoresServiceMock.validarDisponibilidad.mockRejectedValue(
      new ForbiddenException('Docente no habilitado'),
    );

    await expect(service.guardarPropia(5, { bloques: [] })).rejects.toThrow(
      ForbiddenException,
    );

    expect(profesoresServiceMock.validarDisponibilidad).toHaveBeenCalledWith(5);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
