import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { BidEntity } from '../entities/bid.entity';

@Injectable()
export class BidsRepository {
  constructor(
    @InjectRepository(BidEntity)
    private readonly repository: Repository<BidEntity>,
  ) {}

  create(data: Partial<BidEntity>): BidEntity {
    return this.repository.create(data);
  }

  save(bid: BidEntity): Promise<BidEntity> {
    return this.repository.save(bid);
  }

  findById(id: string): Promise<BidEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        contractor: true,
        task: true,
      },
    });
  }

  findOneByTaskAndContractor(taskId: string, contractorId: string): Promise<BidEntity | null> {
    return this.repository.findOne({ where: { taskId, contractorId } });
  }

  findAndCount(options: FindManyOptions<BidEntity>): Promise<[BidEntity[], number]> {
    return this.repository.findAndCount(options);
  }
}
