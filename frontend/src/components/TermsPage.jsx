import React from 'react';
import StaticPage from './StaticPage';

export default function TermsPage() {
  return (
    <StaticPage
      title="Terms of service"
      subtitle="Plain-English rules for using Answerdeck."
    >
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Using the service</h2>
        <p>
          Answerdeck is a brand visibility monitoring product. You agree to use it only for
          lawful market research purposes, and not to impersonate another brand, scrape other
          users&apos; content, or abuse the LLM/search APIs we call on your behalf.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Subscriptions</h2>
        <p>
          Plans are monthly, billed in INR via Razorpay. You can cancel any time from your
          Razorpay subscription portal; cancellations take effect at the end of the current
          billing cycle.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">No guarantees about LLM output</h2>
        <p>
          The analysis surfaces raw responses from third-party LLMs. While Answerdeck verifies
          cited URLs and filters unsupported brand claims, we cannot guarantee the accuracy of any
          statement an LLM makes. Use the outputs as market intelligence, not legal or medical
          advice.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Changes</h2>
        <p>
          We may update these terms to reflect new features or legal requirements. Material
          changes will be emailed to the address on your Clerk account at least 14 days in
          advance.
        </p>
      </section>
    </StaticPage>
  );
}
