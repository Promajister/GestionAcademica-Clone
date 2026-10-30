import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CargaDocenteService } from './carga-docente.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('CargaDocenteService', () => {
  let service: CargaDocenteService;

  const prismaMock = {
    curso: { findUnique: jest.fn() },
    profesor: { findMany: jest.fn() },
    cargaDocente: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const cursoPropio = { id_curso: 1, asignatura: { origen: 'INTERNA' } };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CargaDocenteService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<CargaDocenteService>(CargaDocenteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rechaza un curso que no existe', async () => {
    prismaMock.curso.findUnique.mockResolvedValue(null);

    await expect(
      service.asignarCarga({ id_curso: 99, profesores: [] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rechaza asignar carga a una asignatura externa', async () => {
    prismaMock.curso.findUnique.mockResolvedValue({
      id_curso: 1,
      asignatura: { origen: 'EXTERNA' },
    });

    await expect(
      service.asignarCarga({ id_curso: 1, profesores: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('CA4: rechaza profesores inactivos o no registrados', async () => {
    prismaMock.curso.findUnique.mockResolvedValue(cursoPropio);
    prismaMock.profesor.findMany.mockResolvedValue([{ id_usuario: 5 }]);

    await expect(
      service.asignarCarga({
        id_curso: 1,
        profesores: [
          { id_usuario: 5, cantidad_horas: 2 },
          { id_usuario: 6, cantidad_horas: 2 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('CA1: reemplaza la carga del curso en una transacción', async () => {
    prismaMock.curso.findUnique.mockResolvedValue(cursoPropio);
    prismaMock.profesor.findMany.mockResolvedValue([
      { id_usuario: 5 },
      { id_usuario: 6 },
    ]);
    prismaMock.$transaction.mockResolvedValue([{ count: 0 }, { count: 2 }]);

    await service.asignarCarga({
      id_curso: 1,
      profesores: [
        { id_usuario: 5, cantidad_horas: 2 },
        { id_usuario: 6, cantidad_horas: 4 },
      ],
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.cargaDocente.createMany).toHaveBeenCalledWith({
      data: [
        { id_curso: 1, id_usuario: 5, cantidad_horas: 2 },
        { id_curso: 1, id_usuario: 6, cantidad_horas: 4 },
      ],
    });
  });

  it('404 al eliminar una asignación que no existe', async () => {
    prismaMock.cargaDocente.findFirst.mockResolvedValue(null);

    await expect(service.eliminarCarga(1, 5)).rejects.toThrow(
      NotFoundException,
    );
  });
});
