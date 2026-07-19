import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { AuthResponse, AuthTokens, SignupResult } from '@anura/shared';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { RefreshDto } from './dto/refresh.dto';
import { OtpRequestDto } from './dto/otp-request.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { VerifySignupDto } from './dto/verify-signup.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Creates the account unverified and emails a code — returns no tokens. */
  @Public()
  @Post('signup')
  signup(@Body() dto: SignupDto): Promise<SignupResult> {
    return this.auth.signup(dto.email, dto.password, dto.fullName);
  }

  /** Confirms the emailed code and signs the new user in. */
  @Public()
  @Post('signup/verify')
  @HttpCode(HttpStatus.OK)
  verifySignup(@Body() dto: VerifySignupDto): Promise<AuthResponse> {
    return this.auth.verifySignup(dto.email, dto.code);
  }

  @Public()
  @Post('signup/resend')
  @HttpCode(HttpStatus.OK)
  resendSignupOtp(@Body() dto: OtpRequestDto): Promise<{ sent: true }> {
    return this.auth.resendSignupOtp(dto.email);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.auth.login(dto.email, dto.password);
  }

  /** Sign in or sign up with a Google Identity Services ID token. */
  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  google(@Body() dto: GoogleAuthDto): Promise<AuthResponse> {
    return this.auth.googleAuth(dto.idToken);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<AuthTokens> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() dto: OtpRequestDto): Promise<{ sent: true }> {
    return this.auth.requestOtp(dto.email);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: OtpVerifyDto): Promise<AuthResponse> {
    return this.auth.verifyOtp(dto.email, dto.code);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser('sub') userId: string, @Body() dto: RefreshDto): Promise<void> {
    return this.auth.logout(userId, dto.refreshToken);
  }
}
