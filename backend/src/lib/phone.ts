import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

type Customer = { id: string; phone?: string | null; metadata?: Record<string, unknown> | null };
type Challenge = { phone: string; code: string; expires: number; attempts: number };
const challenges = new Map<string, Challenge>();
const sends = new Map<string, number[]>();

export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/[\s()-]/g, '');
  const match = /^(?:\+91|91)?([6-9]\d{9})$/.exec(digits);
  return match ? `+91${match[1]}` : null;
}

export function phoneMode(): 'local' | 'twilio' | 'unavailable' {
  if (process.env.NODE_ENV !== 'production' && process.env.PHONE_VERIFY_LOCAL === 'true') return 'local';
  if (/^AC[0-9a-f]{32}$/i.test(process.env.TWILIO_ACCOUNT_SID || '') && /^VA[0-9a-f]{32}$/i.test(process.env.TWILIO_VERIFY_SERVICE_SID || '') && process.env.TWILIO_AUTH_TOKEN) return 'twilio';
  return 'unavailable';
}

export function phoneVerified(customer: Customer): boolean {
  const phone = normalizePhone(customer.phone);
  const method = customer.metadata?.gehna_phone_verified_method;
  const at = customer.metadata?.gehna_phone_verified_at;
  const signature = customer.metadata?.gehna_phone_verified_sig;
  if (!phone || customer.metadata?.gehna_phone_verified !== phone || typeof at !== 'string' || typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature) || (method !== 'twilio' && !(method === 'local' && phoneMode() === 'local'))) return false;
  const expected = signVerifiedPhone(customer.id, phone, at, method);
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}

export function signVerifiedPhone(customerId: string, phone: string, at: string, method: string): string {
  if (!process.env.JWT_SECRET) throw new Error('Backend signing secret is missing.');
  return createHmac('sha256', process.env.JWT_SECRET).update([customerId, phone, at, method].join('\0')).digest('hex');
}

export function phoneStatus(customer: Customer) {
  return { phone: customer.phone || '', verified: phoneVerified(customer), available: phoneMode() !== 'unavailable', local_preview: phoneMode() === 'local' };
}

function allowSend(key: string): boolean {
  const now = Date.now();
  const recent = (sends.get(key) || []).filter(time => now - time < 3_600_000);
  if (recent.length >= 5 || (recent.length && now - recent[recent.length - 1] < 60_000)) return false;
  sends.set(key, [...recent, now]);
  // ponytail: per-process abuse limit; use shared rate limits when running multiple backend workers.
  return true;
}

async function twilio(path: string, data: Record<string, string>): Promise<Record<string, unknown>> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const service = process.env.TWILIO_VERIFY_SERVICE_SID!;
  const response = await fetch(`https://verify.twilio.com/v2/Services/${service}/${path}`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data),
  });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error('The SMS provider could not complete verification. Please try again later.');
  return result;
}

export async function startPhoneVerification(customerId: string, phone: string) {
  const mode = phoneMode();
  if (mode === 'unavailable') throw new Error('Mobile verification is not configured yet.');
  if (!allowSend(customerId) || !allowSend(phone)) throw new Error('Please wait before requesting another code.');
  if (mode === 'twilio') {
    const result = await twilio('Verifications', { To: phone, Channel: 'sms' });
    if (result.status !== 'pending') throw new Error('The SMS could not be sent. Please try again.');
    return { sent: true, local_preview: false };
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  challenges.set(customerId, { phone, code, expires: Date.now() + 300_000, attempts: 0 });
  return { sent: true, local_preview: true, dev_code: code };
}

export async function checkPhoneVerification(customerId: string, phone: string, code: string): Promise<boolean> {
  if (!/^\d{4,10}$/.test(code)) return false;
  if (phoneMode() === 'twilio') {
    const result = await twilio('VerificationCheck', { To: phone, Code: code });
    return result.status === 'approved' && result.to === phone;
  }
  if (phoneMode() !== 'local') return false;
  const challenge = challenges.get(customerId);
  if (!challenge || challenge.phone !== phone || challenge.expires < Date.now() || challenge.attempts >= 5) return false;
  challenge.attempts++;
  const a = Buffer.from(challenge.code);
  const b = Buffer.from(code);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function clearPhoneChallenge(customerId: string) { challenges.delete(customerId); }
