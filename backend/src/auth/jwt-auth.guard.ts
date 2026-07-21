import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT authentication guard.
 * Applied via @UseGuards(JwtAuthGuard) to protect routes.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
