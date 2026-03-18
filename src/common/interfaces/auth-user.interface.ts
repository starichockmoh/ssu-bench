import { UserRole } from '../types/role.enum';

export interface AuthUser {
  sub: string;
  role: UserRole;
  email: string;
  isBlocked: boolean;
}
