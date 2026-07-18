import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Low-level email sender. Provider `resend` calls the Resend API;
 * provider `log` just logs the payload (default, so sending works in dev).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  private get cfg(): AppConfig['email'] {
    return this.config.get<AppConfig['email']>('email')!;
  }

  async sendEmail({ to, subject, text, html }: SendEmailInput): Promise<{ ok: boolean; id?: string }> {
    const cfg = this.cfg;
    if (cfg.provider !== 'resend') {
      this.logger.log(`[email:log] -> ${to} | ${subject}\n${text}`);
      return { ok: true, id: 'logged' };
    }
    if (!cfg.apiKey) {
      this.logger.warn('Email resend provider selected but RESEND_API_KEY missing');
      return { ok: false };
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: cfg.from, to: [to], subject, text, ...(html ? { html } : {}) }),
    });

    if (!res.ok) {
      this.logger.error(`Email send failed (${res.status}): ${await res.text()}`);
      return { ok: false };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  }
}
