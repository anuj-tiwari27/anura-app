import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@anura/shared';
import type { AuthResponse, AuthTokens, JwtPayload, PublicUser } from '@anura/shared';
import type { Lawyer, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toPublicUser } from '../../common/mappers/user.mapper';
import { AuditService } from '../audit/audit.service';
import type { AppConfig } from '../../config/configuration';

const BCRYPT_ROUNDS = 10;
const OTP_MIN = 100000;
const OTP_MAX = 900000; // 6-digit codes: 100000..999999

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient?: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get jwtCfg(): AppConfig['jwt'] {
    return this.config.get<AppConfig['jwt']>('jwt')!;
  }

  private get googleCfg(): AppConfig['google'] {
    return this.config.get<AppConfig['google']>('google')!;
  }

  // --- Public flows ---------------------------------------------------------

  async signup(email: string, password: string, fullName: string): Promise<AuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName: fullName.trim(),
        role: UserRole.LAWYER,
      },
    });

    const tokens = await this.issueTokens(user);
    return { user: await this.buildPublicUser(user), tokens };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user);
    return { user: await this.buildPublicUser(user), tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.jwtCfg.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const now = new Date();
    const candidates = await this.prisma.refreshToken.findMany({
      where: { userId: payload.sub, revokedAt: null, expiresAt: { gt: now } },
    });

    let matched: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (await bcrypt.compare(refreshToken, candidate.tokenHash)) {
        matched = candidate;
        break;
      }
    }
    if (!matched) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: revoke the presented token, then issue a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: now },
    });

    return this.issueTokens(user);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const now = new Date();
    const candidates = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null },
    });

    for (const candidate of candidates) {
      if (await bcrypt.compare(refreshToken, candidate.tokenHash)) {
        await this.prisma.refreshToken.update({
          where: { id: candidate.id },
          data: { revokedAt: now },
        });
      }
    }
  }

  async requestOtp(email: string): Promise<{ sent: true }> {
    const normalizedEmail = email.trim().toLowerCase();

    // Ensure a user exists so OTP can also register a brand-new account.
    await this.prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {},
      create: { email: normalizedEmail, role: UserRole.LAWYER },
    });

    const code = this.generateOtp();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + this.jwtCfg.otpTtl * 1000);

    await this.prisma.otpCode.create({
      data: { email: normalizedEmail, codeHash, purpose: 'LOGIN', expiresAt },
    });

    // In production this dispatches via email/SMS; here we log it.
    this.logger.log(`OTP for ${normalizedEmail}: ${code} (expires in ${this.jwtCfg.otpTtl}s)`);
    return { sent: true };
  }

  async verifyOtp(email: string, code: string): Promise<AuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    const otp = await this.prisma.otpCode.findFirst({
      where: { email: normalizedEmail, purpose: 'LOGIN', consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const valid = await bcrypt.compare(code, otp.codeHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: now },
    });

    // Upsert-on-verify guards against a user deleted between request and verify.
    const user = await this.prisma.user.upsert({
      where: { email: normalizedEmail },
      update: { emailVerified: true },
      create: { email: normalizedEmail, role: UserRole.LAWYER, emailVerified: true },
    });

    const tokens = await this.issueTokens(user);
    return { user: await this.buildPublicUser(user), tokens };
  }

  /**
   * Sign in / sign up with a Google Identity Services ID token.
   * Verifies the token against GOOGLE_CLIENT_ID, then finds-or-creates the
   * user by email (same pattern as OTP verify — passwordHash stays null).
   */
  async googleAuth(idToken: string): Promise<AuthResponse> {
    const { clientId } = this.googleCfg;
    if (!clientId) {
      throw new ServiceUnavailableException('GOOGLE_CLIENT_ID is not configured');
    }
    this.googleClient ??= new OAuth2Client(clientId);

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }
    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('Your Google account has no verified email');
    }

    const normalizedEmail = payload.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Never overwrite a profile the user has already filled in.
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            emailVerified: true,
            fullName: existing.fullName ?? payload.name ?? null,
            avatarUrl: existing.avatarUrl ?? payload.picture ?? null,
          },
        })
      : await this.prisma.user.create({
          data: {
            email: normalizedEmail,
            role: UserRole.LAWYER,
            emailVerified: true,
            fullName: payload.name ?? null,
            avatarUrl: payload.picture ?? null,
          },
        });

    const tokens = await this.issueTokens(user);
    return { user: await this.buildPublicUser(user), tokens };
  }

  // --- Helpers --------------------------------------------------------------

  private generateOtp(): string {
    return String(OTP_MIN + Math.floor(Math.random() * OTP_MAX)).padStart(6, '0');
  }

  /** Signs an access + refresh pair, persisting a hashed refresh token row. */
  private async issueTokens(user: User): Promise<AuthTokens> {
    const lawyer = await this.prisma.lawyer.findUnique({ where: { userId: user.id } });
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      lawyerId: lawyer?.id ?? null,
    };

    const { accessSecret, refreshSecret, accessTtl, refreshTtl } = this.jwtCfg;

    const accessToken = await this.jwt.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessTtl,
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: refreshTtl,
    });

    const tokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  private async buildPublicUser(user: User, lawyer?: Lawyer | null): Promise<PublicUser> {
    const resolvedLawyer =
      lawyer !== undefined
        ? lawyer
        : await this.prisma.lawyer.findUnique({ where: { userId: user.id } });
    return toPublicUser(user, resolvedLawyer);
  }
}
