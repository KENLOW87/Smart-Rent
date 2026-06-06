const BASE = process.env.TOYYIBPAY_BASE_URL || 'https://toyyibpay.com';

function sanitize(s: string, max: number) {
  // ToyyibPay allows alphanumeric, space and underscore only for name/description
  const cleaned = s.replace(/[^a-zA-Z0-9 _]/g, '').replace(/\s+/g, ' ').trim();
  return (cleaned || 'Rent').slice(0, max);
}

export interface CreateBillInput {
  secretKey?: string;        // property owner's ToyyibPay key (falls back to env)
  categoryCode?: string;     // property owner's ToyyibPay category (falls back to env)
  amountRM: number;          // amount in ringgit
  billName: string;
  billDescription: string;
  externalRef: string;       // our payment id
  returnUrl: string;
  callbackUrl: string;
  payorName: string;
  payorEmail: string;
  payorPhone: string;
}

export async function createBill(input: CreateBillInput): Promise<string> {
  const userSecretKey = input.secretKey || process.env.TOYYIBPAY_SECRET_KEY;
  const categoryCode = input.categoryCode || process.env.TOYYIBPAY_CATEGORY_CODE;
  if (!userSecretKey || !categoryCode) {
    throw new Error('ToyyibPay is not set up for this property owner (no secret key / category).');
  }

  const params = new URLSearchParams({
    userSecretKey,
    categoryCode,
    billName: sanitize(input.billName, 30),
    billDescription: sanitize(input.billDescription, 100),
    billPriceSetting: '1',                                  // fixed amount
    billPayorInfo: '1',                                     // collect payer info
    billAmount: String(Math.round(input.amountRM * 100)),  // amount in CENTS
    billReturnUrl: input.returnUrl,
    billCallbackUrl: input.callbackUrl,
    billExternalReferenceNo: input.externalRef,
    billTo: sanitize(input.payorName, 30),
    billEmail: input.payorEmail,
    billPhone: input.payorPhone,
    billPaymentChannel: '0',                               // FPX online banking
    billChargeToCustomer: '0',                             // RM1 FPX fee charged to the tenant (payer), not the owner
  });

  const res = await fetch(`${BASE}/index.php/api/createBill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('ToyyibPay createBill returned a non-JSON response: ' + text);
  }
  if (Array.isArray(data) && data[0] && typeof data[0] === 'object' && 'BillCode' in data[0]) {
    return (data[0] as { BillCode: string }).BillCode;
  }
  throw new Error('ToyyibPay createBill failed: ' + text);
}

export function billPaymentUrl(billCode: string) {
  return `${BASE}/${billCode}`;
}

// Re-query ToyyibPay to confirm a bill was really paid.
// Used by the webhook so a spoofed callback POST cannot mark rent as paid.
export async function isBillPaid(
  billCode: string,
): Promise<{ paid: boolean; amount: number | null; invoiceNo: string | null }> {
  const res = await fetch(`${BASE}/index.php/api/getBillTransactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ billCode }).toString(),
    cache: 'no-store',
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { paid: false, amount: null, invoiceNo: null };
  }
  if (!Array.isArray(data)) return { paid: false, amount: null, invoiceNo: null };

  for (const raw of data as Record<string, unknown>[]) {
    // Defensive: ToyyibPay key casing has varied across versions
    const keyFor = (needle: string) =>
      Object.keys(raw).find((k) => k.toLowerCase() === needle);
    const statusKey = keyFor('billpaymentstatus');
    const amountKey = keyFor('billpaymentamount');
    const invoiceKey = keyFor('billpaymentinvoiceno');
    const status = statusKey ? String(raw[statusKey]) : '';
    if (status === '1') {
      return {
        paid: true,
        amount: amountKey ? Number(raw[amountKey]) : null,
        invoiceNo: invoiceKey ? String(raw[invoiceKey]) : null,
      };
    }
  }
  return { paid: false, amount: null, invoiceNo: null };
}
