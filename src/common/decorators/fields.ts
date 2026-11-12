import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

interface TextOpts {
  example?: string;
  description?: string;
  maxLength?: number;
  minLength?: number;
}

/** Campo de texto obligatorio: un solo decorador por campo */
export const TextField = (opts: TextOpts = {}) =>
  applyDecorators(
    ApiProperty({
      example: opts.example,
      description: opts.description,
      maxLength: opts.maxLength,
      minLength: opts.minLength,
    }),
    IsString(),
    IsNotEmpty(),
    ...(opts.maxLength !== undefined ? [MaxLength(opts.maxLength)] : []),
    ...(opts.minLength !== undefined ? [MinLength(opts.minLength)] : []),
  );

export const OptionalTextField = (opts: TextOpts = {}) =>
  applyDecorators(
    ApiPropertyOptional({
      example: opts.example,
      description: opts.description,
      maxLength: opts.maxLength,
      minLength: opts.minLength,
    }),
    IsOptional(),
    IsString(),
    ...(opts.maxLength !== undefined ? [MaxLength(opts.maxLength)] : []),
    ...(opts.minLength !== undefined ? [MinLength(opts.minLength)] : []),
  );

export const UuidField = (opts: { example?: string; description?: string } = {}) =>
  applyDecorators(
    ApiProperty({ example: opts.example, description: opts.description }),
    IsUUID(),
  );

export const OptionalUuidField = (
  opts: { example?: string; description?: string } = {},
) =>
  applyDecorators(
    ApiPropertyOptional({ example: opts.example, description: opts.description }),
    IsOptional(),
    IsUUID(),
  );

export const EmailField = (opts: { example?: string } = {}) =>
  applyDecorators(
    ApiProperty({ example: opts.example }),
    IsEmail(),
    MaxLength(254),
  );

export const IntQueryField = (opts: {
  description?: string;
  minimum?: number;
  maximum?: number;
  defaultValue?: number;
}) =>
  applyDecorators(
    ApiPropertyOptional({
      description: opts.description,
      type: Number,
      minimum: opts.minimum,
      maximum: opts.maximum,
      default: opts.defaultValue,
    }),
    IsOptional(),
    Type(() => Number),
    IsInt(),
    ...(opts.minimum !== undefined ? [Min(opts.minimum)] : []),
    ...(opts.maximum !== undefined ? [Max(opts.maximum)] : []),
  );

export const BooleanQueryField = (opts: { example?: boolean } = {}) =>
  applyDecorators(
    ApiPropertyOptional({ example: opts.example }),
    IsOptional(),
    IsBoolean(),
  );

export const OptionalEmailField = (opts: { example?: string } = {}) =>
  applyDecorators(
    ApiPropertyOptional({ example: opts.example }),
    IsOptional(),
    IsEmail(),
    MaxLength(254),
  );

export const EnumOptionalField = (opts: {
  enum: object;
  example?: string;
  description?: string;
}) =>
  applyDecorators(
    ApiPropertyOptional({
      enum: opts.enum,
      example: opts.example,
      description: opts.description,
    }),
    IsOptional(),
    IsEnum(opts.enum),
  );

export const EnumField = (opts: {
  enum: object;
  example?: string;
  description?: string;
}) =>
  applyDecorators(
    ApiProperty({
      enum: opts.enum,
      example: opts.example,
      description: opts.description,
    }),
    IsNotEmpty(),
    IsEnum(opts.enum),
  );

export const ObjectField = (opts: { example?: object; description?: string } = {}) =>
  applyDecorators(
    ApiProperty({ example: opts.example, description: opts.description }),
    IsObject(),
  );
