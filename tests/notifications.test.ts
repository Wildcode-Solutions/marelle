import { describe, expect, it } from "vitest";

import { MailgunEmailChannel, type MailgunFetcher } from "../worker/notifications/mailgun";
import { createNotificationService } from "../worker/notifications";
import { NotificationDeliveryError } from "../worker/notifications/types";

function channelWith(fetcher: MailgunFetcher): MailgunEmailChannel {
  return new MailgunEmailChannel(
    {
      apiKey: "key-test",
      domain: "mg.marelle.test",
      from: { email: "notifications@mg.marelle.test", name: "Marelle" },
      region: "eu",
    },
    fetcher,
  );
}

function requiredRequest(value: Request | null): Request {
  if (!value) throw new Error("La requête Mailgun attendue n’a pas été capturée.");
  return value;
}

describe("Mailgun email notifications", () => {
  it("sends a multipart request to the configured Mailgun region", async () => {
    let capturedRequest: Request | null = null;
    const fetcher: MailgunFetcher = async (input, init) => {
      capturedRequest = new Request(input, init);
      return Response.json({ id: "<message-id@mg.marelle.test>", message: "Queued" });
    };

    const receipt = await channelWith(fetcher).send({
      to: { email: "eleve@marelle.test", name: "Camille" },
      replyTo: { email: "support@marelle.test" },
      subject: "Ta prochaine Marelle est prête",
      text: "Une nouvelle Marelle t’attend.",
      html: "<p>Une nouvelle Marelle t’attend.</p>",
      tags: ["daily-challenge"],
    });

    expect(receipt).toEqual({
      channel: "email",
      externalId: "<message-id@mg.marelle.test>",
      provider: "mailgun",
    });
    expect(capturedRequest).not.toBeNull();
    const request = requiredRequest(capturedRequest);
    expect(request.url).toBe("https://api.eu.mailgun.net/v3/mg.marelle.test/messages");
    expect(request.method).toBe("POST");
    expect(request.headers.get("Authorization")).toBe(`Basic ${btoa("api:key-test")}`);

    const form = await request.formData();
    expect(form.get("from")).toBe("Marelle <notifications@mg.marelle.test>");
    expect(form.getAll("to")).toEqual(["Camille <eleve@marelle.test>"]);
    expect(form.get("subject")).toBe("Ta prochaine Marelle est prête");
    expect(form.get("text")).toBe("Une nouvelle Marelle t’attend.");
    expect(form.get("html")).toBe("<p>Une nouvelle Marelle t’attend.</p>");
    expect(form.get("h:Reply-To")).toBe("support@marelle.test");
    expect(form.getAll("o:tag")).toEqual(["daily-challenge"]);
  });

  it("marks rate limits as retryable without exposing credentials", async () => {
    const fetcher: MailgunFetcher = async () => Response.json(
      { message: "Too many requests" },
      { status: 429, headers: { "X-Request-Id": "mailgun-request-1" } },
    );

    const delivery = channelWith(fetcher).send({
      to: { email: "eleve@marelle.test" },
      subject: "Notification",
      text: "Contenu de la notification.",
    });

    await expect(delivery).rejects.toMatchObject<Partial<NotificationDeliveryError>>({
      message: "Too many requests",
      provider: "mailgun",
      requestId: "mailgun-request-1",
      retryable: true,
      status: 429,
    });
  });

  it("exposes Mailgun through the provider-independent notification service", async () => {
    const fetcher: MailgunFetcher = async () => Response.json({ id: "mailgun-id" });
    const notifications = createNotificationService(
      {
        MAILGUN_API_KEY: "key-test",
        MAILGUN_DOMAIN: "mg.marelle.test",
        MAILGUN_FROM_EMAIL: "notifications@mg.marelle.test",
        MAILGUN_FROM_NAME: "Marelle",
        MAILGUN_REGION: "eu",
      },
      fetcher,
    );

    await expect(notifications.sendEmail({
      to: { email: "eleve@marelle.test" },
      subject: "Notification",
      text: "Contenu de la notification.",
    })).resolves.toMatchObject({ provider: "mailgun", channel: "email" });
  });
});
