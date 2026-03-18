import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { comparePassword } from '../../../common/utils/hash.util';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { UsersRepository } from '../../users/repo/users.repository';
import { UsersService } from '../../users/service/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  register(dto: RegisterDto) {
    return this.usersService.createUser(dto);
  }

  async login(dto: LoginDto): Promise<{ access_token: string }> {
    const user = await this.usersRepository.findByEmail(dto.email);

    if (!user || !(await comparePassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    if (user.isBlocked) {
      throw new ForbiddenException({
        code: 'USER_BLOCKED',
        message: 'Blocked user cannot login',
      });
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
      email: user.email,
      isBlocked: user.isBlocked,
    });

    return { access_token: accessToken };
  }
}
