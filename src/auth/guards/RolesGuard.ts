import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../constant';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger: Logger = new Logger(RolesGuard.name);
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // const roles =
      //   this.reflector.getAllAndMerge<Roles[]>('roles', [
      //     context.getHandler(),
      //     context.getClass(),
      //   ]) || [];

      // console.log({ roles });

      // const { user: userPayload } = context.switchToHttp().getRequest();

      const { user } = context.switchToHttp().getRequest();

      // console.log({ res });

      return user.is_admin;

      // return Array.isArray(roles) && roles.includes(user.is_admin);
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }
}
