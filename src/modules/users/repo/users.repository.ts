import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  create(data: Partial<UserEntity>): UserEntity {
    return this.repository.create(data);
  }

  save(user: UserEntity): Promise<UserEntity> {
    return this.repository.save(user);
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.repository.findOne({
      where: { email: email.trim().toLowerCase() },
    });
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  findAndCount(options: FindManyOptions<UserEntity>): Promise<[UserEntity[], number]> {
    return this.repository.findAndCount(options);
  }
}
