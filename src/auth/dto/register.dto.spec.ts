import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto.js';

describe('RegisterDto', () => {
  it('descarta el campo role con whitelist (no se puede registrar como ADMIN)', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Intento Admin',
      email: 'intento@test.com',
      password: 'Password123!',
      role: 'ADMIN',
    });

    const errors = await validate(dto, { whitelist: true });

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Intento Admin');
    expect(dto.email).toBe('intento@test.com');
    expect(dto).not.toHaveProperty('role');
    expect((dto as unknown as Record<string, unknown>).role).toBeUndefined();
  });

  it('mantiene los campos válidos del registro', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Alumno',
      email: 'alumno@test.com',
      password: 'Password123!',
    });

    const errors = await validate(dto, { whitelist: true });

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Alumno');
  });
});
