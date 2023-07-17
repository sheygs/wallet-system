import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger: Logger = new Logger(RolesGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const { user } = context.switchToHttp().getRequest();

      return user.is_admin;
    } catch (error) {
      this.logger.error({ error });
      return false;
    }
  }
}
