import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private usersRepository: UsersRepository) {}

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
}
