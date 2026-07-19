import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  /** Provider error detail when ok is false — safe to log, not for end users. */
  error?: string;
}

/**
 * Low-level email sender. Provider `resend` calls the Resend API;
 * provider `log` just logs the payload (default, so sending works in dev).
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  private get cfg(): AppConfig['email'] {
    return this.config.get<AppConfig['email']>('email')!;
  }

  /**
   * Announce the active provider at boot. Misconfiguration here is otherwise
   * invisible until a user fails to receive a code.
   */
  onModuleInit(): void {
    const { provider, from, apiKey } = this.cfg;
    if (provider !== 'resend') {
      this.logger.warn(
        `Email provider: "${provider}" — emails are only written to the log, NOT delivered. Set EMAIL_PROVIDER=resend to send real email.`,
      );
      return;
    }
    if (!apiKey) {
      this.logger.error('Email provider: resend, but RESEND_API_KEY is empty — sending will fail.');
      return;
    }
    this.logger.log(`Email provider: resend (from: ${from})`);
  }

  async sendEmail({ to, subject, text, html }: SendEmailInput): Promise<SendEmailResult> {
    const cfg = this.cfg;
    if (cfg.provider !== 'resend') {
      this.logger.log(`[email:log] -> ${to} | ${subject}\n${text}`);
      return { ok: true, id: 'logged' };
    }
    if (!cfg.apiKey) {
      const error = 'RESEND_API_KEY is not set';
      this.logger.error(`Email send skipped: ${error}`);
      return { ok: false, error };
    }

    let res: Response;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: cfg.from, to: [to], subject, text, ...(html ? { html } : {}) }),
      });
    } catch (err) {
      const error = `network error: ${(err as Error).message}`;
      this.logger.error(`Email send failed: ${error}`);
      return { ok: false, error };
    }

    if (!res.ok) {
      const detail = await res.text();
      const error = `${res.status} ${detail}`;
      // Most common causes: the `from` domain is not verified in Resend, or the
      // account is still in testing mode (which only allows sending to your own
      // address). The provider's message says which.
      this.logger.error(`Email send failed (${res.status}) from="${cfg.from}" to="${to}": ${detail}`);
      return { ok: false, error };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  }
}
