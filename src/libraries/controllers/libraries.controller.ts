import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LibrariesService } from '../services/libraries.service.js';
import { CreateLibraryDto } from '../dto/create-library.dto.js';
import { UpdateLibraryDto } from '../dto/update-library.dto.js';
import { ListLibrariesQueryDto } from '../dto/list-libraries-query.dto.js';
import { auth, info } from '../../common/decorators/auth.js';
import { uuidParam } from '../../common/decorators/current-user.js';
import { setTotalCount, type totalCountHeader } from '../../common/total-count.js';

@ApiTags('libraries')
@Controller('libraries')
export class LibrariesReadController {
  constructor(private readonly librariesService: LibrariesService) {}

  @Get()
  @info('listar las librerías curadas (público, paginado)')
  async findAll(
    @Query() query: ListLibrariesQueryDto,
    @Res({ passthrough: true }) res: totalCountHeader,
  ) {
    const { items, total } = await this.librariesService.findAll(query);
    setTotalCount(res, total);
    return items;
  }

  @Get(':id')
  @info('obtener una librería curada por su uuid')
  findOne(@uuidParam() id: string) {
    return this.librariesService.findOne(id);
  }
}

@ApiTags('libraries')
@Controller('libraries')
export class LibrariesWriteController {
  constructor(private readonly librariesService: LibrariesService) {}

  @Post()
  @auth('admin', 'crear una librería curada (solo admin)')
  create(@Body() dto: CreateLibraryDto) {
    return this.librariesService.create(dto);
  }

  @Put(':id')
  @auth('admin', 'actualizar una librería curada (solo admin)')
  update(@uuidParam() id: string, @Body() dto: UpdateLibraryDto) {
    return this.librariesService.update(id, dto);
  }

  @Delete(':id')
  @auth('admin', 'eliminar una librería curada (solo admin)')
  remove(@uuidParam() id: string) {
    return this.librariesService.remove(id);
  }
}
