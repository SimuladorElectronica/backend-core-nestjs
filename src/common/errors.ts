import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

/** helpers en minúsculas para no acoplar las clases de servicio a nombres externos */
export const notFound = (message: string) => new NotFoundException(message);
export const forbidden = (message: string) => new ForbiddenException(message);
export const conflict = (message: string) => new ConflictException(message);
export const badRequest = (message: string) =>
  new BadRequestException(message);
export const unauthorized = (message: string) =>
  new UnauthorizedException(message);
export const internalError = (message: string) =>
  new InternalServerErrorException(message);
