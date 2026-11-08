import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';

const SUBMISSION_INCLUDE = {
  guide: { select: { id: true, title: true } },
  project: { select: { id: true, title: true, shareSlug: true } },
} satisfies Prisma.SubmissionInclude;

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubmissionDto, studentId: string) {
    const guide = await this.prisma.guide.findUnique({
      where: { id: dto.guideId },
      select: { id: true },
    });

    if (!guide) {
      throw new NotFoundException(`No existe la guía "${dto.guideId}"`);
    }

    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true, userId: true },
    });

    if (!project) {
      throw new NotFoundException(`No existe el proyecto "${dto.projectId}"`);
    }

    // Solo proyectos propios: los anónimos (userId null) y ajenos se rechazan
    if (project.userId !== studentId) {
      throw new ForbiddenException(
        'El proyecto no te pertenece: solo podés entregar proyectos propios',
      );
    }

    return this.prisma.submission.create({
      data: {
        guideId: dto.guideId,
        studentId,
        projectId: dto.projectId,
      },
      include: SUBMISSION_INCLUDE,
    });
  }
}
