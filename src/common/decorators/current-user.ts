import {
  createParamDecorator,
  ExecutionContext,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';

/** usuario autenticado inyectado por el guard jwt (null si es anónimo) */
export const currentUser = createParamDecorator(
  (_data, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest().user ?? null,
);

/** param de ruta `:id` validado como uuid */
export const uuidParam = () => Param('id', ParseUUIDPipe);

/** param de ruta con nombre dinámico (ej. `key` de shareSlug o uuid) */
export const routeParam = (name: string) => Param(name);
