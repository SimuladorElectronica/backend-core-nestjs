import { ExecutionContext } from '@nestjs/common';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard.js';

const anonymousContext = (): ExecutionContext =>
  (({
    switchToHttp: () => ({
      getRequest: () => ({ headers: {} }),
    }),
  }) as unknown as ExecutionContext);

describe('OptionalJwtAuthGuard', () => {
  it('deja pasar peticiones sin Authorization (usuario anónimo)', () => {
    const guard = new OptionalJwtAuthGuard();

    expect(guard.canActivate(anonymousContext())).toBe(true);
  });
});
