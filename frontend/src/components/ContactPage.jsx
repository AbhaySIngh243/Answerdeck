import React from 'react';
import StaticPage from './StaticPage';
import { SUPPORT_EMAIL_HELLO } from '../lib/supportEmails';

const linkClass = 'text-brand-primary hover:underline';

export default function ContactPage() {
  return (
    <StaticPage title="Contact" subtitle="We reply fast — usually within one business day.">
      <section className="space-y-4">
        <p>
          For sales, partnerships, product questions, privacy, billing, technical help, or general
          support, email{' '}
          <a href={`mailto:${SUPPORT_EMAIL_HELLO}`} className={linkClass}>
            {SUPPORT_EMAIL_HELLO}
          </a>
          . Include the email on your account when relevant.
        </p>
      </section>
    </StaticPage>
  );
}
