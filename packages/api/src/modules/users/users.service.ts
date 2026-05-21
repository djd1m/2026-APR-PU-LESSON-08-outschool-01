import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@Injectable()
export class UsersService {
  constructor(
    private usersRepository: UsersRepository,
    private prisma: PrismaService,
  ) {}

  async findById(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findAll(page = 1, perPage = 20) {
    const skip = (page - 1) * perPage;
    const { items, total } = await this.usersRepository.findAll({
      skip,
      take: perPage,
    });

    return {
      items,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async update(id: string, data: { name?: string; phone?: string; avatarUrl?: string }) {
    await this.findById(id);
    return this.usersRepository.update(id, data);
  }

  async delete(id: string) {
    await this.findById(id);
    return this.usersRepository.delete(id);
  }

  async createChild(parentId: string, data: { name: string; birthDate: string; interests: string[] }) {
    await this.findById(parentId);
    return this.usersRepository.createChild(parentId, {
      name: data.name,
      birthDate: new Date(data.birthDate),
      interests: data.interests,
    });
  }

  async getChildren(parentId: string) {
    return this.usersRepository.findChildrenByParentId(parentId);
  }
}
