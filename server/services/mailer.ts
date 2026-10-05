// Envoi d'e-mails transactionnels. Fournisseur actuel : l'API HTTP de Resend
// (aucune dépendance) ; RESEND_API_KEY et MAIL_FROM activent l'envoi. Sans
// configuration, rien n'est envoyé : les appelants restent en mode aperçu.
// Pour un relais SMTP interne, ajouter un transport ici avec la même signature.

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailConfig {
  provider: "resend";
  apiKey: string;
  from: string;
}

export type MailResult = { delivered: true; id: string | null } | { delivered: false; reason: string };

export function mailConfig(env: Record<string, string | undefined> = process.env): MailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.MAIL_FROM?.trim();
  return apiKey && from ? { provider: "resend", apiKey, from } : null;
}

export async function sendMail(msg: MailMessage, config: MailConfig, fetchImpl: typeof fetch = fetch): Promise<MailResult> {
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    });
    if (!res.ok) return { delivered: false, reason: `HTTP ${res.status} ${(await res.text()).slice(0, 200)}` };
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { delivered: true, id: body.id ?? null };
  } catch (e) {
    return { delivered: false, reason: (e as Error).message };
  }
}
