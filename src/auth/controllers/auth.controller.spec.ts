import 'reflect-metadata';
import { AuthController } from './auth.controller.js';
import { AuthService } from '../services/auth.service.js';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';

const GUARDS_METADATA = '__guards__';

describe('AuthController', () => {
  let controller: AuthController;
  let service: {
    register: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = { register: vi.fn(), login: vi.fn() };
    controller = new AuthController(service as unknown as AuthService);
  });

  it('POST /auth/register delega en el servicio', async () => {
    const dto = { name: 'alumno', email: 'a@test.com', password: 'password_segura' };
    service.register.mockResolvedValue({ message: 'ok', access_token: 't' });

    await expect(controller.register(dto)).resolves.toEqual({ message: 'ok', access_token: 't' });
    expect(service.register).toHaveBeenCalledWith(dto);
  });

  it('POST /auth/login delega en el servicio', async () => {
    const dto = { email: 'a@test.com', password: 'password_segura' };
    service.login.mockResolvedValue({ access_token: 't' });

    await expect(controller.login(dto)).resolves.toEqual({ access_token: 't' });
    expect(service.login).toHaveBeenCalledWith(dto);
  });

  it('GET /auth/me exige JWT y devuelve la identidad del token', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, controller.getProfile) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
    expect(controller.getProfile({ id: 'u-1' })).toEqual({ id: 'u-1' });
  });
});
