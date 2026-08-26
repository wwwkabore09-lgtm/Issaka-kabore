import { Injectable } from '@nestjs/common';
import type { CategoryDto } from '@finza/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // Catégories système (partagées) + catégories propres à l'utilisateur.
  async findAllForUser(userId: string): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: [{ kind: 'asc' }, { label: 'asc' }],
    });

    return categories.map((category) => ({
      id: category.id,
      userId: category.userId,
      key: category.key,
      label: category.label,
      kind: category.kind,
    }));
  }
}
