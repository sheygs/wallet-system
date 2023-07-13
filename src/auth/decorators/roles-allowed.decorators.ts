import { Roles } from '../constant';
import { SetMetadata } from '@nestjs/common';

export const RolesAllowed = (...roles: Roles[]) => SetMetadata('roles', roles);
