import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../../common/interfaces/auth-user.interface';
import { PaymentsService } from '../service/payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  listPayments(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthUser) {
    return this.paymentsService.listPayments(query, user);
  }

  @Get(':id')
  getPayment(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.getPayment(id, user);
  }
}
