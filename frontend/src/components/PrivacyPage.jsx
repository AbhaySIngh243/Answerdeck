import React from 'react';
import StaticPage from './StaticPage';
import { SUPPORT_EMAIL_DEV, SUPPORT_EMAIL_HELLO } from '../lib/supportEmails';

export default function PrivacyPage() {
  return (
    <StaticPage
      title="Privacy Policy"
      subtitle="Last Updated: May 2026"
    >
      <section>
        <p>
          At Answrdeck (&quot;Answrdeck&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), we take your privacy
          seriously. This Privacy Policy explains what information we collect, how we use it, and the
          choices you have regarding your information when using our website and services.
        </p>
        <p>
          By using Answrdeck, you agree to the practices described in this Privacy Policy.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Information We Collect</h2>
        <p>When you create an account or use our services, we may collect:</p>

        <h3 className="mt-4 text-base font-semibold text-slate-900">Account Information</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Name</li>
          <li>Email address</li>
          <li>Password</li>
          <li>Company name</li>
        </ul>

        <h3 className="mt-4 text-base font-semibold text-slate-900">Project and Usage Data</h3>
        <p>When you use Answrdeck, we may collect information necessary to provide our services, including:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Projects you create</li>
          <li>Prompts you submit</li>
          <li>AI-generated responses returned by supported AI providers</li>
          <li>Visibility scores and analysis results</li>
          <li>Competitor tracking data</li>
          <li>Reports and exports generated through the platform</li>
        </ul>

        <h3 className="mt-4 text-base font-semibold text-slate-900">Technical Information</h3>
        <p>We may automatically collect:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>IP address</li>
          <li>Browser type and version</li>
          <li>Device information</li>
          <li>Operating system</li>
          <li>Referring website</li>
          <li>Usage activity within the platform</li>
          <li>Cookie and session information</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">How We Use Your Information</h2>
        <p>We use collected information to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Provide and operate the Answrdeck platform</li>
          <li>Create and manage user accounts</li>
          <li>Generate visibility reports and recommendations</li>
          <li>Improve product functionality and performance</li>
          <li>Monitor platform usage and security</li>
          <li>Communicate with you regarding your account or service updates</li>
          <li>Respond to support requests</li>
          <li>Prevent fraud, abuse, or unauthorized access</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">AI Service Providers</h2>
        <p>
          To provide visibility analysis and reporting, prompts and related project data may be
          transmitted to third-party artificial intelligence providers.
        </p>
        <p>These providers currently include:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>OpenAI</li>
          <li>Anthropic</li>
          <li>Google AI (Gemini)</li>
          <li>DeepSeek</li>
        </ul>
        <p>
          Data shared with these providers is used solely to generate responses and analyses required
          to operate the service.
        </p>
        <p>
          We encourage users not to submit confidential, regulated, or highly sensitive information
          through prompts.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Analytics and Advertising</h2>
        <p>
          We use analytics tools to understand how visitors interact with our website and platform.
        </p>
        <p>These may include:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Google Analytics</li>
          <li>Microsoft Clarity</li>
        </ul>
        <p>We may also use advertising and conversion tracking technologies provided by:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Meta</li>
          <li>LinkedIn</li>
          <li>Google Ads</li>
        </ul>
        <p>
          These tools may use cookies or similar technologies to measure website traffic, campaign
          performance, and user engagement.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Cookies</h2>
        <p>Answrdeck uses cookies and similar technologies to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Maintain user sessions</li>
          <li>Authenticate users</li>
          <li>Remember preferences</li>
          <li>Analyze website traffic</li>
          <li>Measure marketing effectiveness</li>
        </ul>
        <p>
          You can control cookie settings through your browser. Disabling cookies may impact certain
          features of the service.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Payments</h2>
        <p>Payments are processed through third-party payment providers, including:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Cashfree Payments</li>
        </ul>
        <p>
          Answrdeck does not store or process credit card, debit card, banking credentials, or payment
          instrument details on its own servers.
        </p>
        <p>
          Payment information is handled directly by the payment processor according to their privacy
          and security policies.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Data Retention</h2>
        <p>
          We retain account information and project data for as long as necessary to provide our
          services.
        </p>
        <p>
          Following account deletion, data may be retained for up to 90 days for backup, security,
          operational, and legal purposes before permanent deletion.
        </p>
        <p>
          We may retain limited information longer where required by law or to protect our legitimate
          business interests.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Data Security</h2>
        <p>
          We implement reasonable technical and organizational safeguards designed to protect your
          information from unauthorized access, disclosure, alteration, or destruction.
        </p>
        <p>
          However, no internet-based service can guarantee absolute security, and you use the platform
          at your own risk.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Sharing of Information</h2>
        <p>We do not sell your personal information.</p>
        <p>We may share information with:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Service providers that help us operate the platform</li>
          <li>Authentication providers</li>
          <li>Cloud hosting providers</li>
          <li>Analytics providers</li>
          <li>Payment processors</li>
          <li>AI service providers</li>
          <li>Legal authorities when required by law</li>
        </ul>
        <p>
          All sharing is limited to what is reasonably necessary to provide the service or comply with
          legal obligations.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Your Rights</h2>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Access your personal information</li>
          <li>Correct inaccurate information</li>
          <li>Request deletion of your information</li>
          <li>Object to certain processing activities</li>
          <li>Request a copy of your data</li>
        </ul>
        <p>To exercise these rights, contact us using the details below.</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Third-Party Services</h2>
        <p>Our platform may contain links to third-party websites or services.</p>
        <p>
          We are not responsible for the privacy practices, content, or security of third-party
          services.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Changes to This Privacy Policy</h2>
        <p>We may update this Privacy Policy from time to time.</p>
        <p>
          If material changes are made, we will update the &quot;Last Updated&quot; date and may provide
          additional notice where appropriate.
        </p>
        <p>
          Continued use of the service after changes become effective constitutes acceptance of the
          updated policy.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or our privacy practices, contact us at:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <a href={`mailto:${SUPPORT_EMAIL_HELLO}`} className="text-brand-primary hover:underline">
              {SUPPORT_EMAIL_HELLO}
            </a>{' '}
            (general and privacy inquiries)
          </li>
          <li>
            <a href={`mailto:${SUPPORT_EMAIL_DEV}`} className="text-brand-primary hover:underline">
              {SUPPORT_EMAIL_DEV}
            </a>{' '}
            (technical support)
          </li>
        </ul>
      </section>
    </StaticPage>
  );
}
