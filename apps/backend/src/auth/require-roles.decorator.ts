import { SetMetadata } from '@nestjs/common';
import { ROLE_METADATA_KEY, UserRole } from './roles';

export const RequireRoles = (...roles: UserRole[]) => SetMetadata(ROLE_METADATA_KEY, roles);