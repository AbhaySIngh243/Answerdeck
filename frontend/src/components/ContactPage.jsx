import React from 'react';
import StaticPage from './StaticPage';

export default function ContactPage() {
  return (
    <StaticPage title="Contact" subtitle="We reply fast — usually within one business day.">
      <section className="space-y-4">
        <p>
          For sales, partnerships, or product questions, email{' '}
          <a href="mailto:hello@answerdeck.com" className="text-brand-primary">
            hello@answerdeck.com
          </a>
          .
        </p>
        <p>
          For account or billing issues, email{' '}
          <a href="mailto:support@answerdeck.com" className="text-brand-primary">
            support@answerdeck.com
          </a>{' '}
          and include the email address on your Clerk account.
        </p>
        <p>
          For anything related to data, privacy, or GDPR, email{' '}
          <a href="mailto:privacy@answerdeck.com" className="text-brand-primary">
            privacy@answerdeck.com
          </a>
          .
        </p>
      </section>
    </StaticPage>
  );
}
