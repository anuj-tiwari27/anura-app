import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from './common/decorators/public.decorator';
import type { AppConfig } from './config/configuration';

/** Which integrations are live, without leaking any secret. */
interface ConfigReport {
  env: string;
  webOrigin: string;
  providers: {
    email: { provider: string; from: string; apiKeyConfigured: boolean };
    ai: { provider: string; openaiKeyConfigured: boolean; anthropicKeyConfigured: boolean };
    storage: { provider: string };
    whatsapp: { provider: string; credentialsConfigured: boolean };
    payments: { provider: string };
    ecourts: { provider: string; tokenConfigured: boolean };
    google: { clientIdConfigured: boolean };
  };
}

@Controller()
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get('health')
  health(): { status: string; service: string; time: string } {
    return { status: 'ok', service: 'anura-api', time: new Date().toISOString() };
  }

  /**
   * Effective provider configuration, for verifying a deploy actually picked up
   * its environment variables. Deliberately reports only provider names and
   * "is it set" booleans — never keys, tokens, endpoints or bucket names — so it
   * is safe to expose without auth (you often need it precisely when auth or
   * email is misconfigured and you cannot log in).
   */
  @Public()
  @Get('health/config')
  configReport(): ConfigReport {
    const email = this.config.get<AppConfig['email']>('email')!;
    const ai = this.config.get<AppConfig['ai']>('ai')!;
    const storage = this.config.get<AppConfig['storage']>('storage')!;
    const whatsapp = this.config.get<AppConfig['whatsapp']>('whatsapp')!;
    const payments = this.config.get<AppConfig['payments']>('payments')!;
    const ecourts = this.config.get<AppConfig['ecourts']>('ecourts')!;
    const google = this.config.get<AppConfig['google']>('google')!;

    return {
      env: this.config.get<string>('env') ?? 'unknown',
      webOrigin: this.config.get<string>('webOrigin') ?? '',
      providers: {
        // `from` is a public sender address, and seeing it is the fastest way to
        // spot the "domain not verified in Resend" failure.
        email: { provider: email.provider, from: email.from, apiKeyConfigured: !!email.apiKey },
        ai: {
          provider: ai.provider,
          openaiKeyConfigured: !!ai.openaiApiKey,
          anthropicKeyConfigured: !!ai.anthropicApiKey,
        },
        storage: { provider: storage.provider },
        whatsapp: {
          provider: whatsapp.provider,
          credentialsConfigured: !!whatsapp.accessToken && !!whatsapp.phoneNumberId,
        },
        payments: { provider: payments.provider },
        ecourts: { provider: ecourts.provider, tokenConfigured: !!ecourts.apiToken },
        google: { clientIdConfigured: !!google.clientId },
      },
    };
  }
}
