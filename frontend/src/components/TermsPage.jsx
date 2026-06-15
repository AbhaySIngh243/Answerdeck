import React from 'react';
import StaticPage from './StaticPage';
import { SUPPORT_EMAIL_DEV, SUPPORT_EMAIL_HELLO } from '../lib/supportEmails';

export default function TermsPage() {
  return (
    <StaticPage
      title="Terms of service"
      subtitle="Plain-English rules for using Answrdeck."
    >
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Using the service</h2>
        <p>
          Answrdeck is a brand visibility monitoring product. You agree to use it only for
          lawful market research purposes, and not to impersonate another brand, scrape other
          users&apos; content, or abuse the LLM/search APIs we call on your behalf.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Subscriptions</h2>
        <p>
          Plans are one-time monthly payments processed securely via Cashfree. International cards are
          supported (your bank converts the amount at checkout); customers in India can also pay by UPI or
          net banking. Pay again each month to renew. Cancelling from Settings stops renewal — access
          continues until the paid period ends.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">No guarantees about LLM output</h2>
        <p>
          The analysis surfaces raw responses from third-party LLMs. While Answrdeck verifies
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

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
        <p>
          Questions about these terms, your account, or the service? Reach us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL_HELLO}`} className="text-brand-primary hover:underline">
            {SUPPORT_EMAIL_HELLO}
          </a>{' '}
          for general inquiries, or{' '}
          <a href={`mailto:${SUPPORT_EMAIL_DEV}`} className="text-brand-primary hover:underline">
            {SUPPORT_EMAIL_DEV}
          </a>{' '}
          for technical support.
        </p>
      </section>
    </StaticPage>
  );
}
