import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '@anura/shared';

/**
 * Injects the authenticated user (JwtPayload) into a controller handler.
 * `@CurrentUser()` -> full payload; `@CurrentUser('sub')` -> just the id.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    return data ? user?.[data] : user;
  },
);
