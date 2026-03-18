import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthUser } from '../interfaces/auth-user.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Bearer token is required',
      });
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      request.user = this.jwtService.verify<AuthUser>(token);
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Invalid or expired token',
      });
    }
  }
}
