import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { TaskEntity } from '../entities/task.entity';

@Injectable()
export class TasksRepository {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly repository: Repository<TaskEntity>,
  ) {}

  create(data: Partial<TaskEntity>): TaskEntity {
    return this.repository.create(data);
  }

  save(task: TaskEntity): Promise<TaskEntity> {
    return this.repository.save(task);
  }

  findById(id: string): Promise<TaskEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        customer: true,
        selectedBid: true,
      },
    });
  }

  findAndCount(options: FindManyOptions<TaskEntity>): Promise<[TaskEntity[], number]> {
    return this.repository.findAndCount(options);
  }
}
