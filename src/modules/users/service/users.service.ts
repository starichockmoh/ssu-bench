import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { UserRole } from '../../../common/types/role.enum';
import { hashPassword } from '../../../common/utils/hash.util';
import { getPagination } from '../../../common/utils/pagination';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserEntity } from '../entities/user.entity';
import { UsersRepository } from '../repo/users.repository';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DomainEventsService } from '../../notifications/service/domain-events.service';
import { NotificationEventType } from '../../notifications/constants/event-types';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly domainEventsService: DomainEventsService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async createUser(dto: CreateUserDto): Promise<UserEntity> {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException({
        code: 'USER_ALREADY_EXISTS',
        message: 'User already exists',
      });
    }

    const user = this.usersRepository.create({
      email: dto.email,
      passwordHash: await hashPassword(dto.password),
      role: dto.role,
      balance: dto.balance ?? (dto.role === UserRole.CUSTOMER ? 100 : 0),
    });

    return this.usersRepository.save(user);
  }

  async getByIdOrFail(id: string): Promise<UserEntity> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }
    return user;
  }

  async listUsers(query: PaginationQueryDto): Promise<PaginatedResponseDto<UserEntity>> {
    const { page, limit, skip } = getPagination(query);
    const [items, total] = await this.usersRepository.findAndCount({
      take: limit,
      skip,
      order: { createdAt: 'DESC' },
    });

    return { items, total, page, limit };
  }

  async blockUser(id: string): Promise<UserEntity> {
    const user = await this.getByIdOrFail(id);
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(UserEntity);
      user.isBlocked = true;
      const savedUser = await repository.save(user);
      await this.domainEventsService.appendEvent({
        manager,
        eventType: NotificationEventType.UserBlocked,
        aggregateType: 'user',
        aggregateId: savedUser.id,
        initiatorUserId: null,
        payload: {
          userId: savedUser.id,
          email: savedUser.email,
        },
      });

      return savedUser;
    });
  }

  async unblockUser(id: string): Promise<UserEntity> {
    const user = await this.getByIdOrFail(id);
    user.isBlocked = false;
    return this.usersRepository.save(user);
  }

  ensureNotBlocked(user: UserEntity): void {
    if (user.isBlocked) {
      throw new ForbiddenException({
        code: 'USER_BLOCKED',
        message: 'Blocked user cannot perform this operation',
      });
    }
  }
}
