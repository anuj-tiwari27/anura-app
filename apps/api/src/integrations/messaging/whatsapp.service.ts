import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

export interface WhatsAppTemplateParam {
  type: 'text';
  text: string;
}

/**
 * Low-level WhatsApp sender. Provider `meta` calls the Meta WhatsApp Cloud API;
 * provider `log` just logs the payload (default, so reminders work in dev).
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(private readonly config: ConfigService) {}

  private get cfg(): AppConfig['whatsapp'] {
    return this.config.get<AppConfig['whatsapp']>('whatsapp')!;
  }

  get verifyToken(): string {
    return this.cfg.verifyToken;
  }

  async sendText(to: string, body: string): Promise<{ ok: boolean; id?: string }> {
    return this.send(to, { type: 'text', text: { preview_url: false, body } });
  }

  async sendTemplate(
    to: string,
    templateName: string,
    languageCode = 'en',
    params: WhatsAppTemplateParam[] = [],
  ): Promise<{ ok: boolean; id?: string }> {
    return this.send(to, {
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: params.length ? [{ type: 'body', parameters: params }] : [],
      },
    });
  }

  private async send(to: string, message: Record<string, unknown>): Promise<{ ok: boolean; id?: string }> {
    const cfg = this.cfg;
    if (cfg.provider !== 'meta') {
      this.logger.log(`[whatsapp:log] -> ${to}: ${JSON.stringify(message)}`);
      return { ok: true, id: 'logged' };
    }
    if (!cfg.phoneNumberId || !cfg.accessToken) {
      this.logger.warn('WhatsApp meta provider selected but credentials missing');
      return { ok: false };
    }

    const url = `https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, ...message }),
    });

    if (!res.ok) {
      this.logger.error(`WhatsApp send failed (${res.status}): ${await res.text()}`);
      return { ok: false };
    }
    const data = (await res.json()) as { messages?: Array<{ id: string }> };
    return { ok: true, id: data.messages?.[0]?.id };
  }
}
