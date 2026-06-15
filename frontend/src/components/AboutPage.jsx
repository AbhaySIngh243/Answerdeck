import React from 'react';
import { Link } from 'react-router-dom';
import StaticPage from './StaticPage';
import { SUPPORT_EMAIL_DEV, SUPPORT_EMAIL_HELLO } from '../lib/supportEmails';

export default function AboutPage() {
  return (
    <StaticPage
      title="About Answrdeck"
      subtitle="We help brands understand and improve how AI assistants recommend them."
    >
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Why this exists</h2>
        <p>
          Generative AI assistants are the new discovery layer. A single recommendation inside
          ChatGPT, Claude, Perplexity, or Gemini decides whether a customer even considers your
          brand. Traditional SEO tools don&apos;t measure that surface. Answrdeck does.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">What we do</h2>
        <ul className="list-disc space-y-2 pl-5 text-slate-600">
          <li>Track how your brand appears across ChatGPT, Gemini, Perplexity, and Claude.</li>
          <li>Verify every cited URL so audits only reference live, reachable pages.</li>
          <li>Surface competitors, source domains, and intent-level opportunities.</li>
          <li>Generate concrete next actions and content drafts in your brand voice.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
        <p>
          Reach us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL_HELLO}`} className="text-brand-primary hover:underline">
            {SUPPORT_EMAIL_HELLO}
          </a>{' '}
          or{' '}
          <a href={`mailto:${SUPPORT_EMAIL_DEV}`} className="text-brand-primary hover:underline">
            {SUPPORT_EMAIL_DEV}
          </a>
          . You can also start tracking your brand on the{' '}
          <Link to="/" className="text-brand-primary">
            home page
          </Link>
          .
        </p>
      </section>
    </StaticPage>
  );
}
