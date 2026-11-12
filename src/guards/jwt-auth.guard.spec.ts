import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  it('se instancia como AuthGuard(jwt)', () => {
    expect(new JwtAuthGuard()).toBeInstanceOf(JwtAuthGuard);
  });
});
