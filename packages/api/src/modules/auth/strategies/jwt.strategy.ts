import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

/**
 * Extract JWT from cookie first, then fall back to Authorization header.
 */
function extractJwtFromCookieOrHeader(req: Request): string | null {
  // Try cookie first
  const cookieToken = req?.cookies?.accessToken;
  if (cookieToken) {
    return cookieToken;
  }

  // Fall back to Authorization: Bearer <token>
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('FATAL: JWT_SECRET must be set and at least 32 characters. Server refuses to start without a secure secret.');
    }
    super({
      jwtFromRequest: extractJwtFromCookieOrHeader,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    return { id: user.id, email: user.email, role: user.role, name: user.name };
  }
}
