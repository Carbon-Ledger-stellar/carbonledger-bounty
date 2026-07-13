import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { publicKey: string; signature: string }) {
    return this.authService.login(body.publicKey, body.signature);
  }
}
