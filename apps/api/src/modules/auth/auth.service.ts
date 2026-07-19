import {
  ConflictException,
  ForbiddenException,
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
import type {
  AuthResponse,
  AuthTokens,
  JwtPayload,
  PublicUser,
  SignupResult,
} from '@anura/shared';
import type { Lawyer, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../integrations/email/email.service';
import { toPublicUser } from '../../common/mappers/user.mapper';
import { AuditService } from '../audit/audit.service';
import type { AppConfig } from '../../config/configuration';

const BCRYPT_ROUNDS = 10;
const OTP_MIN = 100000;
const OTP_MAX = 900000; // 6-digit codes: 100000..999999

/** OTP purposes. SIGNUP codes verify email ownership; LOGIN codes sign in. */
const OTP_SIGNUP = 'SIGNUP';
const OTP_LOGIN = 'LOGIN';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient?: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
  ) {}

  private get jwtCfg(): AppConfig['jwt'] {
    return this.config.get<AppConfig['jwt']>('jwt')!;
  }

  private get googleCfg(): AppConfig['google'] {
    return this.config.get<AppConfig['google']>('google')!;
  }

  // --- Signup + email verification -----------------------------------------

  /**
   * Creates the account in an unverified state and emails a one-time code.
   * Deliberately returns NO tokens — the caller must confirm ownership of the
   * address via POST /auth/signup/verify before being signed in.
   */
  async signup(email: string, password: string, fullName: string): Promise<SignupResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existing?.emailVerified) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Re-signing up on an *unverified* address is allowed: nobody has proven
    // ownership yet, and the code still has to reach the real inbox. Without
    // this, abandoning verification would lock the address out permanently.
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash, fullName: fullName.trim() },
        })
      : await this.prisma.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            fullName: fullName.trim(),
            role: UserRole.LAWYER,
          },
        });

    await this.issueEmailOtp(normalizedEmail, OTP_SIGNUP);

    void this.audit.log({
      actorId: user.id,
      action: 'auth.signup',
      entityType: 'USER',
      entityId: user.id,
      meta: { email: normalizedEmail },
    });

    return { email: normalizedEmail, verificationRequired: true };
  }

  /** Confirms the emailed code, marks the address verified and signs the user in. */
  async verifySignup(email: string, code: string): Promise<AuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    await this.consumeOtp(normalizedEmail, code, OTP_SIGNUP);

    const user = await this.prisma.user.update({
      where: { email: normalizedEmail },
      data: { emailVerified: true },
    });
    const lawyer = await this.ensureLawyer(user.id);

    void this.audit.log({
      actorId: user.id,
      action: 'auth.email_verified',
      entityType: 'USER',
      entityId: user.id,
      meta: { email: normalizedEmail },
    });

    const tokens = await this.issueTokens(user, lawyer);
    return { user: toPublicUser(user, lawyer), tokens };
  }

  /** Sends a fresh signup code (no-op response shape whether or not it applies). */
  async resendSignupOtp(email: string): Promise<{ sent: true }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Don't reveal whether the address exists; only actually send when useful.
    if (user && !user.emailVerified) {
      await this.issueEmailOtp(normalizedEmail, OTP_SIGNUP);
    }
    return { sent: true };
  }

  // --- Password login -------------------------------------------------------

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

    // Credentials are good but the address was never confirmed. Send a fresh
    // code and signal with 403 (401 stays "bad credentials") so the client can
    // route to the verification screen.
    if (!user.emailVerified) {
      await this.issueEmailOtp(normalizedEmail, OTP_SIGNUP);
      throw new ForbiddenException(
        'Please verify your email to continue — we have sent you a new code.',
      );
    }

    const lawyer = await this.ensureLawyer(user.id);
    void this.audit.log({
      actorId: user.id,
      action: 'auth.login',
      entityType: 'USER',
      entityId: user.id,
      meta: { email: normalizedEmail },
    });

    const tokens = await this.issueTokens(user, lawyer);
    return { user: toPublicUser(user, lawyer), tokens };
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

  // --- Passwordless (OTP) login --------------------------------------------

  async requestOtp(email: string): Promise<{ sent: true }> {
    const normalizedEmail = email.trim().toLowerCase();

    // Ensure a user exists so OTP can also register a brand-new account.
    await this.prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {},
      create: { email: normalizedEmail, role: UserRole.LAWYER },
    });

    await this.issueEmailOtp(normalizedEmail, OTP_LOGIN);
    return { sent: true };
  }

  async verifyOtp(email: string, code: string): Promise<AuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    await this.consumeOtp(normalizedEmail, code, OTP_LOGIN);

    // Upsert-on-verify guards against a user deleted between request and verify.
    const user = await this.prisma.user.upsert({
      where: { email: normalizedEmail },
      update: { emailVerified: true },
      create: { email: normalizedEmail, role: UserRole.LAWYER, emailVerified: true },
    });
    const lawyer = await this.ensureLawyer(user.id);

    void this.audit.log({
      actorId: user.id,
      action: 'auth.otp_login',
      entityType: 'USER',
      entityId: user.id,
      meta: { email: normalizedEmail },
    });

    const tokens = await this.issueTokens(user, lawyer);
    return { user: toPublicUser(user, lawyer), tokens };
  }

  /**
   * Sign in / sign up with a Google Identity Services ID token.
   * Google has already verified the address, so no OTP step is needed.
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
    const lawyer = await this.ensureLawyer(user.id);

    void this.audit.log({
      actorId: user.id,
      action: 'auth.google_login',
      entityType: 'USER',
      entityId: user.id,
      meta: { email: normalizedEmail },
    });

    const tokens = await this.issueTokens(user, lawyer);
    return { user: toPublicUser(user, lawyer), tokens };
  }

  // --- Helpers --------------------------------------------------------------

  private generateOtp(): string {
    return String(OTP_MIN + Math.floor(Math.random() * OTP_MAX)).padStart(6, '0');
  }

  /** Generates a code, stores its hash and emails it. */
  private async issueEmailOtp(email: string, purpose: string): Promise<void> {
    const code = this.generateOtp();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + this.jwtCfg.otpTtl * 1000);
    const minutes = Math.max(1, Math.round(this.jwtCfg.otpTtl / 60));

    await this.prisma.otpCode.create({ data: { email, codeHash, purpose, expiresAt } });

    const subject =
      purpose === OTP_SIGNUP ? 'Verify your email for Anura' : 'Your Anura sign-in code';
    const intro =
      purpose === OTP_SIGNUP
        ? 'Welcome to Anura. Use this code to verify your email address:'
        : 'Use this code to sign in to Anura:';

    await this.email.sendEmail({
      to: email,
      subject,
      text: `${intro}\n\n${code}\n\nThis code expires in ${minutes} minutes. If you did not request it, you can safely ignore this email.`,
    });

    // The log email provider prints the body, but keep an explicit line so the
    // code is easy to find in dev logs regardless of provider.
    if (this.config.get<string>('env') !== 'production') {
      this.logger.log(`OTP (${purpose}) for ${email}: ${code}`);
    }
  }

  /** Validates + consumes the latest unexpired code for this email/purpose. */
  private async consumeOtp(email: string, code: string, purpose: string): Promise<void> {
    const now = new Date();
    const otp = await this.prisma.otpCode.findFirst({
      where: { email, purpose, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const valid = await bcrypt.compare(code.trim(), otp.codeHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: now } });
  }

  /**
   * Guarantees a Lawyer row exists for the user.
   *
   * Created at account creation rather than at onboarding so that `lawyerId` is
   * present in the very first JWT. Otherwise a token minted before onboarding
   * carries lawyerId=null and every lawyer-scoped endpoint rejects the user
   * with "Complete onboarding first" until the access token expires.
   */
  private async ensureLawyer(userId: string): Promise<Lawyer> {
    return this.prisma.lawyer.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  /** Signs an access + refresh pair, persisting a hashed refresh token row. */
  private async issueTokens(user: User, lawyer?: Lawyer | null): Promise<AuthTokens> {
    const resolvedLawyer =
      lawyer !== undefined
        ? lawyer
        : await this.prisma.lawyer.findUnique({ where: { userId: user.id } });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      lawyerId: resolvedLawyer?.id ?? null,
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
