import Brevo from '@getbrevo/brevo';

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

const DEFAULT_SENDER: EmailAddress = {
  email: 'info@hocfam.org',
  name: 'Household Of Covenant And Faith Apostolic Ministry',
};

const rawBrevoApiKey = process.env.BREVO_API_KEY?.trim();
const apiInstance = new Brevo.TransactionalEmailsApi();

if (rawBrevoApiKey) {
  apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, rawBrevoApiKey);
}

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
  const replyTo = options.replyTo ? normalizeAddress(options.replyTo, DEFAULT_SENDER) : undefined;

  try {
    await apiInstance.sendTransacEmail({
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
