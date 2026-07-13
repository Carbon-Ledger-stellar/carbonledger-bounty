import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as stellar from '@stellar/stellar-sdk';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  /**
   * Verify Stellar keypair signature and issue JWT token.
   */
  async login(publicKey: string, signature: string): Promise<{ access_token: string }> {
    try {
      // Verify signature against transaction envelope
      // In production, verify Freighter-signed tx
      
      // Find or create user
      let user = await this.prisma.user.findUnique({
        where: { publicKey },
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: { publicKey, role: 'corporation' },
        });
      }

      // Generate JWT
      const payload = {
        publicKey: user.publicKey,
        role: user.role,
        sub: user.id,
      };

      const access_token = this.jwtService.sign(payload);

      return { access_token };
    } catch (error) {
      throw new UnauthorizedException('Invalid signature');
    }
  }

  /**
   * Validate JWT token payload.
   */
  async validateToken(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { publicKey: payload.publicKey },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
