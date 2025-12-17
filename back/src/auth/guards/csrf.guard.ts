import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const cookie = req.cookies?.csrf_token;
    const header = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
    if (!cookie || !header || cookie !== header) {
      throw new ForbiddenException('CSRF token missing or invalid');
    }
    return true;
  }
}
