import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AuthUser } from '../../../common/interfaces/auth-user.interface';
import { UserRole } from '../../../common/types/role.enum';
import { UsersService } from '../service/users.service';
import { Query } from '@nestjs/common';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.usersService.getByIdOrFail(user.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  listUsers(@Query() query: PaginationQueryDto) {
    return this.usersService.listUsers(query);
  }

  @Patch(':id/block')
  @Roles(UserRole.ADMIN)
  blockUser(@Param('id') id: string) {
    return this.usersService.blockUser(id);
  }

  @Patch(':id/unblock')
  @Roles(UserRole.ADMIN)
  unblockUser(@Param('id') id: string) {
    return this.usersService.unblockUser(id);
  }
}
