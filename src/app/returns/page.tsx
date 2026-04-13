'use client';

export default function ReturnsPage() {
  // This URL will be your Shopify customer accounts URL
  const shopifyAccountUrl = 'https://account.missfinchnyc.com';

  return (
    <div className="min-h-screen bg-[#FAF9F7]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap');
        .font-serif { font-family: 'Cormorant Garamond', serif; }
      `}</style>

      {/* Header */}
      <div className="bg-[#1a1a1a] py-6 text-center">
        <h1 className="font-serif text-white text-2xl font-medium tracking-widest">MISS FINCH NYC</h1>
      </div>

      <div className="max-w-md mx-auto px-6 py-12">
        {/* Title */}
        <h2 className="font-serif text-3xl font-medium text-gray-900 text-center mb-3">
          Returns &amp; Exchanges
        </h2>
        <p className="text-center text-gray-500 text-base mb-10">
          We want you to love every piece. If something isn&apos;t right, we&apos;ll make it easy.
        </p>

        {/* CTA */}
        <a
          href={shopifyAccountUrl}
          className="block w-full py-5 bg-[#1a1a1a] text-white text-center rounded-xl text-lg font-semibold mb-6 hover:bg-gray-800 transition-colors"
        >
          Start Your Return
        </a>

        <p className="text-center text-sm text-gray-400 mb-12">
          Log in with your email to view your orders and request a return.
        </p>

        {/* Policy Summary */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-green-50 rounded-xl p-5">
            <div className="text-base font-semibold text-green-700 mb-2">Store Credit</div>
            <div className="text-sm text-green-900 leading-relaxed">
              Full value + 5% bonus<br />
              Free return label<br />
              14-day window
            </div>
          </div>
          <div className="bg-amber-50 rounded-xl p-5">
            <div className="text-base font-semibold text-amber-700 mb-2">Refund</div>
            <div className="text-sm text-amber-900 leading-relaxed">
              Value minus processing fee<br />
              Free return label<br />
              7-day window
            </div>
          </div>
        </div>

        {/* How it works */}
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-4">How It Works</h3>
        <div className="space-y-4 mb-8">
          {[
            { n: '1', t: 'Log in to your account', d: 'Use your email — no password needed. We\'ll send a quick verification code.' },
            { n: '2', t: 'Select items to return', d: 'Choose the items and tell us why. It takes 30 seconds.' },
            { n: '3', t: 'Get your free label', d: 'A prepaid return label is emailed to you automatically.' },
            { n: '4', t: 'Ship it back', d: 'Drop off at any USPS location. We\'ll process your credit or refund when it arrives.' },
          ].map(step => (
            <div key={step.n} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                {step.n}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">{step.t}</div>
                <div className="text-sm text-gray-500 mt-0.5">{step.d}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer links */}
        <div className="text-center text-sm text-gray-400 space-y-2">
          <a href="https://www.missfinchnyc.com/pages/miss-finch-nyc-return-policy" className="underline block">
            Full Return Policy
          </a>
          <a href="https://www.missfinchnyc.com/pages/contact-us" className="underline block">
            Need help? Contact us
          </a>
        </div>
      </div>
    </div>
  );
}
