import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { ProfesoresService } from './profesores.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('ProfesoresService - HOR-13 CA3', () => {
  let service: ProfesoresService;

  const prismaMock = {
    profesor: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    cargaDocente: {
      count: jest.fn(),
    },
    disponibilidad: {
      count: jest.fn(),
    },
    bloqueProtegido: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfesoresService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<ProfesoresService>(ProfesoresService);
  });

  it('debe existir el servicio', () => {
    expect(service).toBeDefined();
  });

  it('CA3: impide eliminar un docente con carga asignada', async () => {
    const idProfesor = 5;

    prismaMock.profesor.findUnique.mockResolvedValue({
      id_usuario: idProfesor,
      contrato: 'HORAS',
      usuario: {
        id: idProfesor,
        nombre: 'Docente de Prueba',
        activo: true,
      },
      _count: {
        cargaDocentes: 1,
      },
    });

    prismaMock.cargaDocente.count.mockResolvedValue(1);

    await expect(service.remove(idProfesor)).rejects.toThrow(ConflictException);

    expect(prismaMock.cargaDocente.count).toHaveBeenCalledWith({
      where: { id_usuario: idProfesor },
    });

    expect(prismaMock.profesor.delete).not.toHaveBeenCalled();
  });

  it('permite eliminar un docente sin registros asociados', async () => {
    const idProfesor = 5;

    prismaMock.profesor.findUnique.mockResolvedValue({
      id_usuario: idProfesor,
      contrato: 'HORAS',
      usuario: {
        id: idProfesor,
        nombre: 'Docente de Prueba',
        activo: true,
      },
      _count: {
        cargaDocentes: 0,
      },
    });

    prismaMock.cargaDocente.count.mockResolvedValue(0);
    prismaMock.disponibilidad.count.mockResolvedValue(0);
    prismaMock.bloqueProtegido.count.mockResolvedValue(0);

    prismaMock.profesor.delete.mockResolvedValue({
      id_usuario: idProfesor,
    });

    const resultado = await service.remove(idProfesor);

    expect(resultado).toEqual({
      mensaje: 'Docente eliminado correctamente',
    });

    expect(prismaMock.profesor.delete).toHaveBeenCalledWith({
      where: { id_usuario: idProfesor },
    });
  });

  it('devuelve 404 cuando el docente no existe', async () => {
    prismaMock.profesor.findUnique.mockResolvedValue(null);

    await expect(service.remove(999)).rejects.toThrow(NotFoundException);

    expect(prismaMock.profesor.delete).not.toHaveBeenCalled();
  });

  it('impide eliminar docentes con disponibilidad registrada', async () => {
    const idProfesor = 5;

    prismaMock.profesor.findUnique.mockResolvedValue({
      id_usuario: idProfesor,
      contrato: 'HORAS',
      _count: { cargaDocentes: 0 },
    });

    prismaMock.cargaDocente.count.mockResolvedValue(0);
    prismaMock.disponibilidad.count.mockResolvedValue(2);
    prismaMock.bloqueProtegido.count.mockResolvedValue(0);

    await expect(service.remove(idProfesor)).rejects.toThrow(ConflictException);

    expect(prismaMock.profesor.delete).not.toHaveBeenCalled();
  });
});
