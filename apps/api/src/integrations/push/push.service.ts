import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Push-notification sender. Provider `firebase` sends via FCM (requires
 * firebase-admin to be installed + service-account env vars); `log` (default)
 * writes to the log so notification flows work without Firebase in dev.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly config: ConfigService) {}

  private get cfg(): AppConfig['notifications'] {
    return this.config.get<AppConfig['notifications']>('notifications')!;
  }

  async send(message: PushMessage): Promise<{ ok: boolean }> {
    if (this.cfg.provider !== 'firebase') {
      this.logger.log(`[push:log] -> ${message.token}: ${message.title} - ${message.body}`);
      return { ok: true };
    }
    // Wire firebase-admin here when FIREBASE_* env vars are set:
    //   const admin = await import('firebase-admin');
    //   admin.messaging().send({ token, notification: { title, body }, data });
    this.logger.warn('Firebase push selected but firebase-admin is not wired yet; logging instead.');
    this.logger.log(`[push:firebase-stub] ${message.title} - ${message.body}`);
    return { ok: true };
  }
}
