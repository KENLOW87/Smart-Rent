import Link from 'next/link';

// ToyyibPay redirects the payer here after payment with query params:
// ?status_id=1&billcode=xxx&order_id=yyy&msg=...&transaction_id=...
export default async function PayReturn({
  searchParams,
}: {
  searchParams: Promise<{ status_id?: string; billcode?: string; order_id?: string }>;
}) {
  const sp = await searchParams;
  const success = sp.status_id === '1';
  const pending = sp.status_id === '2';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-8 border border-slate-200 text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 ${
          success ? 'bg-emerald-100' : pending ? 'bg-amber-100' : 'bg-red-100'
        }`}>
          {success ? '✓' : pending ? '⏳' : '✕'}
        </div>
        <h1 className="text-xl font-semibold mb-1">
          {success ? 'Payment successful' : pending ? 'Payment pending' : 'Payment not completed'}
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          {success
            ? 'Thank you! Your rent payment has been received. It may take a moment to show as paid.'
            : pending
            ? 'Your payment is being processed. We will update your status once confirmed.'
            : 'Your payment did not go through. You can try again from your dashboard.'}
        </p>
        <Link href="/tenant"
          className="block w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium">
          Back to my rental
        </Link>
      </div>
    </div>
  );
}
