import React from 'react';
import StaticPage from './StaticPage';

export default function PrivacyPage() {
  return (
    <StaticPage
      title="Privacy policy"
      subtitle="How Answerdeck handles your data, keys, and analysis outputs."
    >
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Data we collect</h2>
        <p>
          We collect the minimum information needed to operate your account: your Clerk
          authentication profile (email and user id), the brand / project metadata you supply, the
          tracking prompts you configure, and the LLM responses we retrieve on your behalf. We do
          not sell or rent any of this data.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">What we send to third parties</h2>
        <p>
          To run an analysis we send your prompt text to the LLM providers you select (OpenAI,
          Anthropic, DeepSeek, Perplexity, Google Gemini). For web-search grounding we send the
          query to Serper (Google SERP) or Perplexity Search. Only the prompt text is shared — not
          your project metadata or account details.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Payments</h2>
        <p>
          Subscriptions are processed by Razorpay. We never see or store your card details;
          Razorpay returns a subscription id which we associate with your Clerk user id so we can
          honour plan limits.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Retention</h2>
        <p>
          Analysis outputs are kept in your project until you delete them. You can delete any
          project at any time from the Projects view; that action cascades and removes prompts,
          responses, mentions, and metrics associated with the project.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
        <p>
          For any data or privacy questions reach{' '}
          <a href="mailto:privacy@answerdeck.com" className="text-brand-primary">
            privacy@answerdeck.com
          </a>
          .
        </p>
      </section>
    </StaticPage>
  );
}
