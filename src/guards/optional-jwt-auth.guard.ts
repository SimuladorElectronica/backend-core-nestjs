import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard opcional: si la petición NO trae header Authorization deja pasar
 * (usuario anónimo, req.user queda undefined). Si trae un token, lo valida
 * normalmente y devuelve 401 si es inválido.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const hasToken = Boolean(request.headers.authorization);

    if (!hasToken) {
      return true;
    }

    return super.canActivate(context);
  }
}
