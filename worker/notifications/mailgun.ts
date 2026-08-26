import type {
  EmailAddress,
  EmailNotification,
  NotificationChannel,
  NotificationReceipt,
} from "./types";
import {
  NotificationConfigurationError,
  NotificationDeliveryError,
  NotificationValidationError,
} from "./types";

const MAILGUN_ENDPOINTS = {
  eu: "https://api.eu.mailgun.net",
  us: "https://api.mailgun.net",
} as const;
const MAX_RESPONSE_BYTES = 32_768;
const MAX_RECIPIENTS = 50;

export type MailgunRegion = keyof typeof MAILGUN_ENDPOINTS;
export type MailgunFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface MailgunEmailChannelConfig {
  apiKey: string;
  domain: string;
  from: EmailAddress;
  region: string;
  timeoutMs?: number;
}

interface MailgunResponseBody {
  id?: unknown;
  message?: unknown;
}

function requiredValue(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new NotificationConfigurationError(`La configuration Mailgun « ${label} » est vide.`);
  }
  return normalized;
}

function assertSingleLine(value: string, label: string, configuration = false): void {
  if (/\r|\n/.test(value)) {
    const message = `${label} contient un saut de ligne invalide.`;
    throw configuration
      ? new NotificationConfigurationError(message)
      : new NotificationValidationError(message);
  }
}

function assertEmailAddress(address: EmailAddress, label: string, configuration = false): void {
  const email = address.email.trim();
  assertSingleLine(email, label, configuration);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    const message = `${label} n’est pas une adresse email valide.`;
    throw configuration
      ? new NotificationConfigurationError(message)
      : new NotificationValidationError(message);
  }
  if (address.name) assertSingleLine(address.name, `${label} (nom)`, configuration);
}

function formatAddress(address: EmailAddress): string {
  const email = address.email.trim();
  const name = address.name?.trim();
  return name ? `${name} <${email}>` : email;
}

function isResponseBody(value: unknown): value is MailgunResponseBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readLimitedJson(response: Response): Promise<MailgunResponseBody | null> {
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isResponseBody(value) ? value : null;
  } catch {
    return null;
  }
}

export class MailgunEmailChannel implements NotificationChannel<EmailNotification> {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly fetcher: MailgunFetcher;
  private readonly from: EmailAddress;
  private readonly timeoutMs: number;

  constructor(config: MailgunEmailChannelConfig, fetcher: MailgunFetcher = fetch) {
    this.apiKey = requiredValue(config.apiKey, "MAILGUN_API_KEY");
    const domain = requiredValue(config.domain, "MAILGUN_DOMAIN");
    if (!/^[a-z0-9.-]+$/i.test(domain)) {
      throw new NotificationConfigurationError("MAILGUN_DOMAIN est invalide.");
    }
    assertEmailAddress(config.from, "MAILGUN_FROM_EMAIL", true);
    if (config.region !== "eu" && config.region !== "us") {
      throw new NotificationConfigurationError("MAILGUN_REGION doit valoir « eu » ou « us ».");
    }

    this.endpoint = `${MAILGUN_ENDPOINTS[config.region]}/v3/${encodeURIComponent(domain)}/messages`;
    this.fetcher = fetcher;
    this.from = config.from;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs < 1_000 || this.timeoutMs > 30_000) {
      throw new NotificationConfigurationError("Le délai Mailgun doit être compris entre 1 et 30 secondes.");
    }
  }

  async send(notification: EmailNotification): Promise<NotificationReceipt> {
    const recipients = Array.isArray(notification.to) ? notification.to : [notification.to];
    if (recipients.length === 0 || recipients.length > MAX_RECIPIENTS) {
      throw new NotificationValidationError(
        `Un email doit avoir entre 1 et ${MAX_RECIPIENTS} destinataires.`,
      );
    }
    recipients.forEach((recipient) => assertEmailAddress(recipient, "Destinataire"));

    const subject = notification.subject.trim();
    const text = notification.text.trim();
    if (!subject) throw new NotificationValidationError("Le sujet de l’email est vide.");
    if (!text) throw new NotificationValidationError("La version texte de l’email est vide.");
    assertSingleLine(subject, "Le sujet");
    if (notification.replyTo) assertEmailAddress(notification.replyTo, "Adresse de réponse");

    const body = new FormData();
    body.set("from", formatAddress(this.from));
    recipients.forEach((recipient) => body.append("to", formatAddress(recipient)));
    body.set("subject", subject);
    body.set("text", text);
    if (notification.html?.trim()) body.set("html", notification.html);
    if (notification.replyTo) body.set("h:Reply-To", formatAddress(notification.replyTo));
    notification.tags?.forEach((tag) => {
      const normalized = tag.trim();
      assertSingleLine(normalized, "Un tag Mailgun");
      if (normalized) body.append("o:tag", normalized);
    });

    let response: Response;
    try {
      response = await this.fetcher(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`api:${this.apiKey}`)}`,
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new NotificationDeliveryError("Impossible de contacter Mailgun.", {
        provider: "mailgun",
        retryable: true,
      });
    }

    const payload = await readLimitedJson(response);
    const requestId = response.headers.get("X-Request-Id") ?? undefined;
    if (!response.ok) {
      const providerMessage = typeof payload?.message === "string"
        ? payload.message
        : `Mailgun a répondu avec le statut ${response.status}.`;
      throw new NotificationDeliveryError(providerMessage, {
        provider: "mailgun",
        requestId,
        retryable: response.status === 429 || response.status >= 500,
        status: response.status,
      });
    }

    return {
      channel: "email",
      externalId: typeof payload?.id === "string" ? payload.id : null,
      provider: "mailgun",
    };
  }
}
