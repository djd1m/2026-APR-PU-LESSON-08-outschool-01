import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from '@klassmarket/shared';

export interface OAuthProfile {
  id: string;
  email?: string;
  name: string;
  avatarUrl?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Пользователь с таким email уже зарегистрирован');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: (dto.role as UserRole) ?? UserRole.PARENT,
      },
    });

    if (user.role === UserRole.TEACHER) {
      await this.prisma.teacherProfile.create({
        data: { userId: user.id },
      });
    }

    this.logger.log(`User registered: ${user.email} (${user.role})`);

    const tokens = this.generateTokens(user.id, user.email, user.role);

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      ...tokens,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    return { id: user.id, email: user.email, role: user.role, name: user.name };
  }

  async login(user: { id: string; email: string; role: string; name: string }) {
    const tokens = this.generateTokens(user.id, user.email, user.role);
    return {
      user,
      ...tokens,
    };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Пользователь не найден');
      }

      return this.generateTokens(user.id, user.email, user.role);
    } catch {
      throw new UnauthorizedException('Невалидный refresh token');
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        phone: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    return user;
  }

  async validateOAuth(
    provider: 'vk' | 'yandex',
    profile: OAuthProfile,
  ) {
    const oauthEmail = profile.email
      ?? `${provider}_${profile.id}@oauth.klassmarket.ru`;

    let user = await this.prisma.user.findUnique({
      where: { email: oauthEmail },
    });

    if (!user) {
      // Auto-create user from OAuth provider
      user = await this.prisma.user.create({
        data: {
          email: oauthEmail,
          passwordHash: '', // OAuth users have no password
          name: profile.name || `${provider} user`,
          role: UserRole.PARENT,
          avatarUrl: profile.avatarUrl,
        },
      });
      this.logger.log(
        `OAuth user created via ${provider}: ${user.email}`,
      );
    }

    const tokens = this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      ...tokens,
    };
  }

  private generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    return {
      accessToken: this.jwtService.sign(payload, {
        expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
      }),
      refreshToken: this.jwtService.sign(payload, {
        expiresIn: process.env.JWT_REFRESH_TTL ?? '7d',
      }),
    };
  }
}
