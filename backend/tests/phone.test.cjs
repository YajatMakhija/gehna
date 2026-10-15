const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, phoneMode, phoneVerified, signVerifiedPhone } = require('../src/lib/phone.ts');

test('local verification works only in development and changes of phone require a new code', () => {
  const original = { NODE_ENV: process.env.NODE_ENV, PHONE_VERIFY_LOCAL: process.env.PHONE_VERIFY_LOCAL, TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID, TWILIO_VERIFY_SERVICE_SID: process.env.TWILIO_VERIFY_SERVICE_SID, TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN, JWT_SECRET: process.env.JWT_SECRET };
  try {
    delete process.env.TWILIO_ACCOUNT_SID; delete process.env.TWILIO_VERIFY_SERVICE_SID; delete process.env.TWILIO_AUTH_TOKEN;
    process.env.NODE_ENV = 'development'; process.env.PHONE_VERIFY_LOCAL = 'true'; process.env.JWT_SECRET = 'phone-test-signing-secret';
    assert.equal(phoneMode(), 'local');
    assert.equal(normalizePhone('98765 43210'), '+919876543210');
    assert.equal(normalizePhone('1234567890'), null);
    const customer = { id: 'cus_one', phone: '+919876543210', metadata: { gehna_phone_verified: '+919876543210', gehna_phone_verified_at: '2026-10-02T00:00:00Z', gehna_phone_verified_method: 'local', gehna_phone_verified_sig: signVerifiedPhone('cus_one', '+919876543210', '2026-10-02T00:00:00Z', 'local') } };
    assert.equal(phoneVerified(customer), true);
    assert.equal(phoneVerified({ ...customer, id: 'cus_two' }), false);
    assert.equal(phoneVerified({ ...customer, metadata: { ...customer.metadata, gehna_phone_verified_at: '2026-10-03T00:00:00Z' } }), false);
    assert.equal(phoneVerified({ ...customer, phone: '+919123456789' }), false);
    process.env.NODE_ENV = 'production';
    assert.equal(phoneMode(), 'unavailable');
    assert.equal(phoneVerified(customer), false);
  } finally {
    for (const [name, value] of Object.entries(original)) value === undefined ? delete process.env[name] : process.env[name] = value;
  }
});
