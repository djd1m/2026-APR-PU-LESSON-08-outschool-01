import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Res,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() _dto: LoginDto, @Request() req: any) {
    return this.authService.login(req.user);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  @Get('vk')
  vkRedirect(@Res() res: Response) {
    const clientId = process.env.VK_CLIENT_ID;
    const redirectUri = encodeURIComponent(
      process.env.VK_REDIRECT_URI ?? 'http://localhost:4000/auth/vk/callback',
    );
    const url =
      `https://id.vk.com/authorize?client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code` +
      `&scope=email`;
    res.redirect(url);
  }

  @Get('vk/callback')
  async vkCallback(
    @Query('code') code: string,
    @Res() res: Response,
  ) {
    try {
      // Exchange code for access token via VK API
      const tokenUrl = 'https://id.vk.com/oauth2/auth';
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: process.env.VK_CLIENT_ID ?? '',
          client_secret: process.env.VK_CLIENT_SECRET ?? '',
          redirect_uri:
            process.env.VK_REDIRECT_URI ??
            'http://localhost:4000/auth/vk/callback',
        }),
      });

      const tokenData = await tokenRes.json();

      // Get user info from VK
      const userRes = await fetch(
        `https://api.vk.com/method/users.get?access_token=${tokenData.access_token}&fields=photo_200,email&v=5.131`,
      );
      const userData = await userRes.json();
      const vkUser = userData.response?.[0];

      const result = await this.authService.validateOAuth('vk', {
        id: String(vkUser?.id ?? tokenData.user_id),
        email: tokenData.email,
        name:
          vkUser
            ? `${vkUser.first_name} ${vkUser.last_name}`
            : 'VK User',
        avatarUrl: vkUser?.photo_200,
      });

      // Redirect to frontend with tokens
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      res.redirect(
        `${frontendUrl}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`,
      );
    } catch {
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }

  @Get('yandex')
  yandexRedirect(@Res() res: Response) {
    const clientId = process.env.YANDEX_CLIENT_ID;
    const redirectUri = encodeURIComponent(
      process.env.YANDEX_REDIRECT_URI ??
        'http://localhost:4000/auth/yandex/callback',
    );
    const url =
      `https://oauth.yandex.ru/authorize?client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code`;
    res.redirect(url);
  }

  @Get('yandex/callback')
  async yandexCallback(
    @Query('code') code: string,
    @Res() res: Response,
  ) {
    try {
      // Exchange code for access token via Yandex API
      const tokenRes = await fetch('https://oauth.yandex.ru/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: process.env.YANDEX_CLIENT_ID ?? '',
          client_secret: process.env.YANDEX_CLIENT_SECRET ?? '',
        }),
      });

      const tokenData = await tokenRes.json();

      // Get user info from Yandex
      const userRes = await fetch('https://login.yandex.ru/info?format=json', {
        headers: {
          Authorization: `OAuth ${tokenData.access_token}`,
        },
      });
      const yandexUser = await userRes.json();

      const result = await this.authService.validateOAuth('yandex', {
        id: yandexUser.id,
        email: yandexUser.default_email,
        name: yandexUser.real_name || yandexUser.display_name || 'Yandex User',
        avatarUrl: yandexUser.default_avatar_id
          ? `https://avatars.yandex.net/get-yapic/${yandexUser.default_avatar_id}/islands-200`
          : undefined,
      });

      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      res.redirect(
        `${frontendUrl}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`,
      );
    } catch {
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }
}
