import { BrevoClient } from '@getbrevo/brevo';

export type EmailAddress = {
  email: string;
  name?: string;
};

export type BrevoMailOptions = {
  from?: string;
  to: string | string[] | EmailAddress[];
  replyTo?: string | EmailAddress;
  subject: string;
  html: string;
};

// EMAIL_FROM must be a sender verified in Brevo (e.g. the church Gmail address)
const DEFAULT_SENDER: EmailAddress = {
  email: process.env.EMAIL_FROM?.trim() || 'info@hocfam.org',
  name: process.env.EMAIL_FROM_NAME?.trim() || 'Household Of Covenant And Faith Apostolic Ministry',
};

const rawBrevoApiKey = process.env.BREVO_API_KEY?.trim();
const brevo = rawBrevoApiKey ? new BrevoClient({ apiKey: rawBrevoApiKey }) : null;

function normalizeAddress(input: string | EmailAddress | undefined, fallback: EmailAddress): EmailAddress {
  if (!input) {
    return fallback;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    const match = trimmed.match(/^(.*)<([^>]+)>$/);
    if (match) {
      return {
        name: match[1].trim().replace(/^"|"$/g, '') || fallback.name,
        email: match[2].trim(),
      };
    }

    return {
      email: trimmed,
      name: fallback.name,
    };
  }

  return {
    email: input.email.trim(),
    name: input.name?.trim() || fallback.name,
  };
}

function normalizeRecipients(recipients: string | string[] | EmailAddress[]): EmailAddress[] {
  const list = Array.isArray(recipients) ? recipients : [recipients];
  return list
    .map((recipient) => normalizeAddress(recipient as string | EmailAddress, DEFAULT_SENDER))
    .filter((recipient) => !!recipient.email);
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    const errorWithMeta = error as Error & {
      code?: string;
      response?: unknown;
      statusCode?: number;
    };

    return {
      message: errorWithMeta.message,
      code: errorWithMeta.code,
      statusCode: errorWithMeta.statusCode,
      response: typeof errorWithMeta.response === 'string' ? errorWithMeta.response : undefined,
    };
  }

  return { message: String(error) };
}

export async function sendBrevoTransactionalEmail(options: BrevoMailOptions): Promise<boolean> {
  if (!rawBrevoApiKey) {
    console.warn('Brevo email send skipped - BREVO_API_KEY is not configured');
    return false;
  }

  const to = normalizeRecipients(options.to);
  if (!to.length) {
    return false;
  }

  const sender = normalizeAddress(options.from, DEFAULT_SENDER);
  // Brevo only sends from a verified address: with EMAIL_FROM set, every email uses it (the display name is kept)
  if (process.env.EMAIL_FROM?.trim()) sender.email = process.env.EMAIL_FROM.trim();
  const replyTo = options.replyTo ? normalizeAddress(options.replyTo, DEFAULT_SENDER) : undefined;

  try {
    await brevo!.transactionalEmails.sendTransacEmail({
      sender,
      to,
      replyTo,
      subject: options.subject,
      htmlContent: options.html,
    });

    return true;
  } catch (error) {
    console.error('Brevo transactional email failed:', normalizeError(error));
    return false;
  }
}
