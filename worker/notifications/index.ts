import { MailgunEmailChannel, type MailgunFetcher } from "./mailgun";
import type {
  EmailNotification,
  NotificationChannel,
  NotificationReceipt,
} from "./types";

export * from "./types";

interface NotificationChannels {
  email: NotificationChannel<EmailNotification>;
}

export interface NotificationEnv {
  MAILGUN_API_KEY: string;
  MAILGUN_DOMAIN: string;
  MAILGUN_FROM_EMAIL: string;
  MAILGUN_FROM_NAME: string;
  MAILGUN_REGION: string;
}

export class NotificationService {
  constructor(private readonly channels: NotificationChannels) {}

  sendEmail(notification: EmailNotification): Promise<NotificationReceipt> {
    return this.channels.email.send(notification);
  }
}

export function createNotificationService(
  env: NotificationEnv,
  fetcher: MailgunFetcher = fetch,
): NotificationService {
  return new NotificationService({
    email: new MailgunEmailChannel(
      {
        apiKey: env.MAILGUN_API_KEY,
        domain: env.MAILGUN_DOMAIN,
        from: {
          email: env.MAILGUN_FROM_EMAIL,
          name: env.MAILGUN_FROM_NAME,
        },
        region: env.MAILGUN_REGION,
      },
      fetcher,
    ),
  });
}
