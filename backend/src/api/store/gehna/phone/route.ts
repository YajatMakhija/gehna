import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { checkPhoneVerification, clearPhoneChallenge, normalizePhone, phoneStatus, signVerifiedPhone, startPhoneVerification } from '../../../../lib/phone';

async function currentCustomer(req: AuthenticatedMedusaRequest) {
  return req.scope.resolve(Modules.CUSTOMER).retrieveCustomer(req.auth_context.actor_id);
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(phoneStatus(await currentCustomer(req)));
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as Record<string, unknown>;
  const phone = normalizePhone(body.phone);
  if (!phone) return res.status(400).json({ message: 'Enter a valid 10-digit Indian mobile number.' });
  const customer = await currentCustomer(req);
  if (body.action === 'start') {
    if (phoneStatus(customer).verified && customer.phone === phone) return res.json({ sent: false, already_verified: true });
    try { return res.json(await startPhoneVerification(customer.id, phone)); }
    catch (error) { return res.status(503).json({ message: (error as Error).message }); }
  }
  if (body.action === 'verify') {
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    let approved = false;
    try { approved = await checkPhoneVerification(customer.id, phone, code); }
    catch { return res.status(503).json({ message: 'Code verification is unavailable. Please try again later.' }); }
    if (!approved) return res.status(400).json({ message: 'That code is incorrect or has expired.' });
    const at = new Date().toISOString();
    const method = process.env.NODE_ENV !== 'production' && process.env.PHONE_VERIFY_LOCAL === 'true' ? 'local' : 'twilio';
    await req.scope.resolve(Modules.CUSTOMER).updateCustomers(customer.id, {
      phone,
      metadata: { ...customer.metadata, gehna_phone_verified: phone, gehna_phone_verified_at: at, gehna_phone_verified_method: method, gehna_phone_verified_sig: signVerifiedPhone(customer.id, phone, at, method) },
    });
    clearPhoneChallenge(customer.id);
    return res.json({ verified: true, phone });
  }
  return res.status(400).json({ message: 'Unknown verification action.' });
}
