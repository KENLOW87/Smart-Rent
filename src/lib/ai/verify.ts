import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export interface ExtractedProof {
  amount: number | null;
  date: string | null;             // ISO yyyy-mm-dd
  reference: string | null;
  bank: string | null;             // source bank or e-wallet
  recipient_name: string | null;   // who the money was sent TO
  recipient_account: string | null; // recipient bank account number
  notes: string | null;
  raw: unknown;
}

const SYSTEM = `You are a Malaysian bank receipt parser. Given a bank transfer receipt or
e-wallet payment slip (Maybank, CIMB, Public Bank, RHB, Hong Leong, BSN, Touch 'n Go,
Boost, GrabPay, DuitNow, etc.), extract payment details. CRITICAL: distinguish the
SENDER from the RECIPIENT. The recipient is the person receiving the money. Always
respond with JSON only, no markdown fences, matching this exact schema:

{
  "amount": number | null,             // MYR amount transferred
  "date": "YYYY-MM-DD" | null,         // transaction date
  "reference": string | null,          // reference / transaction id / payment note
  "bank": string | null,               // SENDER's bank (where the money came from)
  "recipient_name": string | null,     // RECIPIENT's account holder name
  "recipient_account": string | null,  // RECIPIENT's account number (digits only, no spaces)
  "notes": string | null               // any concerns (e.g. "blurry", "missing recipient")
}`;

export async function extractFromPdf(pdfBase64: string): Promise<ExtractedProof> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
        { type: 'text', text: 'Extract the payment details as JSON.' },
      ],
    }],
  });

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return empty('no AI response', message);
  }
  const cleaned = textBlock.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');

  try {
    const parsed = JSON.parse(cleaned);
    return {
      amount: typeof parsed.amount === 'number' ? parsed.amount : Number(parsed.amount) || null,
      date: parsed.date ?? null,
      reference: parsed.reference ?? null,
      bank: parsed.bank ?? null,
      recipient_name: parsed.recipient_name ?? null,
      recipient_account: parsed.recipient_account ?? null,
      notes: parsed.notes ?? null,
      raw: parsed,
    };
  } catch {
    return empty('AI returned non-JSON', textBlock.text);
  }
}

function empty(note: string, raw: unknown): ExtractedProof {
  return {
    amount: null, date: null, reference: null, bank: null,
    recipient_name: null, recipient_account: null,
    notes: note, raw,
  };
}

// Compare two names/accounts loosely — strip spaces, punctuation, case.
export function fuzzyMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}
