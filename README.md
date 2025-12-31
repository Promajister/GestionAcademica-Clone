# Sistema de Gestión Académica (SGA)

**Práctica profesional I — Universidad de Tarapacá**  
**Carrera:** Ingeniería Civil en Computación e Informática

---

## Descripción general

El **Sistema de Gestión Académica (SGA)** es una plataforma web desarrollada para **optimizar la gestión de prácticas profesionales** en la carrera de Pedagogía en Historia, Geografía y Ciencias Sociales de la Universidad de Tarapacá.  

Su objetivo principal es **automatizar y optimizar los procesos de registro, asignación y seguimiento de prácticas profesionales**, así como **centralizar la información de estudiantes, centros educativos, tutores, supervisores y tallertistas** mediante una interfaz moderna, segura e intuitiva.

---

## Arquitectura general

El sistema está construido bajo una **arquitectura cliente-servidor** compuesta por dos módulos principales:

### **Frontend (Angular 19)**
- Framework: Angular 19  
- Librerías UI: Angular Material, Flex Layout  
- Estilo visual: Diseño limpio y adaptable (Responsive Design)  
- Funcionalidades destacadas:
  - Panel de gestión para cada rol (Jefatura, Vinculación, Prácticas)
  - Formularios dinámicos con validaciones reactivas
  - CRUD completo de entidades (Centros, Estudiantes, Supervisores, etc.)
  - Generación de cartas en PDF
  - Integración con backend vía servicios HTTP

### **Backend (NestJS + Prisma + MySQL)**
- Framework: NestJS  
- ORM: Prisma  
- Base de datos: MySQL (Azure Database for MySQL Server / XAMPP local)
- Lenguaje: TypeScript
- Arquitectura: Módulos, controladores y servicios desacoplados
- Seguridad: Validación DTO + control de errores HTTP  
- Funcionalidades principales:
  - API RESTful para todas las entidades
  - Control de relaciones (1:N, N:M)
  - Migraciones automáticas con Prisma
  - Generación de datos semilla (seeding)
  - Exportación de documentos y reportes

---

