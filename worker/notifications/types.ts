export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailNotification {
  html?: string;
  replyTo?: EmailAddress;
  subject: string;
  tags?: string[];
  text: string;
  to: EmailAddress | EmailAddress[];
}

export interface NotificationReceipt {
  channel: "email";
  externalId: string | null;
  provider: string;
}

export interface NotificationChannel<TNotification> {
  send(notification: TNotification): Promise<NotificationReceipt>;
}

export class NotificationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationConfigurationError";
  }
}

export class NotificationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationValidationError";
  }
}

interface DeliveryErrorOptions {
  provider: string;
  requestId?: string;
  retryable: boolean;
  status?: number;
}

export class NotificationDeliveryError extends Error {
  readonly provider: string;
  readonly requestId: string | null;
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(message: string, options: DeliveryErrorOptions) {
    super(message);
    this.name = "NotificationDeliveryError";
    this.provider = options.provider;
    this.requestId = options.requestId ?? null;
    this.retryable = options.retryable;
    this.status = options.status ?? null;
  }
}
