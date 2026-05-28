import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, CreditCard, Mail, Settings, Save } from 'lucide-react';
import DashboardCard from './DashboardCard';
import { Button } from '../ui/button';
import { api } from '../../lib/api';
import { startSubscriptionCheckout } from '../../lib/subscriptionCheckout';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/toast';

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const SettingsView = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: billing, isLoading: billingLoading } = useQuery({
    queryKey: ['billing', 'me'],
    queryFn: api.getBillingMe,
    staleTime: 60_000,
  });
  const { data: billingHealth } = useQuery({
    queryKey: ['billing', 'health'],
    queryFn: api.getBillingHealth,
    staleTime: 120_000,
  });
  const [checkoutBusy, setCheckoutBusy] = useState(null);

  const [timezone, setTimezone] = useState(
    localStorage.getItem('ranklore_timezone') ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      'UTC'
  );
  const [defaultCountry, setDefaultCountry] = useState(
    localStorage.getItem('ranklore_default_country') || ''
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (searchParams.get('billing') !== 'return') return;
    queryClient.invalidateQueries({ queryKey: ['billing', 'me'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    toast.info('Payment submitted', 'We are syncing your subscription status.');
    const next = new URLSearchParams(searchParams);
    next.delete('billing');
    setSearchParams(next, { replace: true });
  }, [queryClient, searchParams, setSearchParams, toast]);

  const save = () => {
    localStorage.setItem('ranklore_timezone', timezone);
    localStorage.setItem('ranklore_default_country', defaultCountry);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast.success('Settings saved');
  };

  const runUpgrade = async (planKey) => {
    setCheckoutBusy(planKey);
    try {
      const outcome = await startSubscriptionCheckout(planKey, { user });
      if (outcome === 'paid') {
        queryClient.invalidateQueries({ queryKey: ['billing', 'me'] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        toast.success('Subscription active', 'We are refreshing your limits now.');
      } else if (outcome === 'dismissed') {
        toast.info('Checkout closed', 'You can restart the upgrade anytime.');
      }
    } catch (e) {
      toast.error('Checkout failed', e?.message || 'Please try again.');
    } finally {
      setCheckoutBusy(null);
    }
  };

  const planLabel =
    billing?.plan === 'pro' ? 'Pro' : billing?.plan === 'standard' ? 'Standard' : 'Free';

  const alertEmail =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    '';

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-2xl space-y-6"
    >
      {/* Header */}
      <motion.div variants={item} className="border-b border-slate-200/60 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Configure workspace defaults for prompt analysis.</p>
      </motion.div>

      <motion.div variants={item}>
        <DashboardCard title="Plan & billing" icon={CreditCard}>
          {billingHealth ? (
            billingHealth.keys_configured && billingHealth.plans_configured ? (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <p className="font-semibold">Billing is fully configured.</p>
                  <p>
                    Payments are collected in {billingHealth.currency} via Cashfree. Renewals and
                    cancellations are handled through Cashfree subscription notifications.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <p className="font-semibold">Billing needs attention.</p>
                  <ul className="mt-0.5 list-disc pl-4">
                    {!billingHealth.keys_configured ? (
                      <li>Cashfree API keys are missing on the server.</li>
                    ) : null}
                    {billingHealth.keys_configured && !billingHealth.plans_configured ? (
                      <li>
                        Plans are not configured yet — the first upgrade click will auto-provision
                        USD plans via the Cashfree API.
                      </li>
                    ) : null}
                    {!billingHealth.webhook_secret_configured ? (
                      <li>
                        Webhook secret is not set in env (a dev secret is auto-generated — paste it
                        into the Cashfree Dashboard webhook config before going live).
                      </li>
                    ) : null}
                  </ul>
                </div>
              </div>
            )
          ) : null}

          {billingLoading ? (
            <p className="text-sm text-slate-400">Loading plan…</p>
          ) : (
            <div className="space-y-4 text-sm text-slate-600">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current plan</p>
                <p className="mt-1 font-semibold text-slate-900">{planLabel}</p>
                {billing?.limits ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Up to {billing.limits.max_projects} project
                    {billing.limits.max_projects === 1 ? '' : 's'} · {billing.limits.max_prompts_per_project} prompts
                    per project
                  </p>
                ) : null}
                {billing?.subscription?.status ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Subscription status:{' '}
                    <span className="font-medium text-slate-700">{billing.subscription.status}</span>
                  </p>
                ) : null}
              </div>
              {billing?.plan === 'free' ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={checkoutBusy}
                    onClick={() => runUpgrade('standard')}
                  >
                    {checkoutBusy === 'standard' ? 'Opening…' : 'Upgrade — Standard'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={checkoutBusy}
                    onClick={() => runUpgrade('pro')}
                  >
                    {checkoutBusy === 'pro' ? 'Opening…' : 'Upgrade — Pro'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" asChild>
                    <Link to="/#pricing">View pricing</Link>
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Manage renewals and payment methods via Cashfree subscription emails. For plan
                  changes, contact support or cancel your current subscription first.
                </p>
              )}
            </div>
          )}
        </DashboardCard>
      </motion.div>

      <motion.div variants={item}>
        <DashboardCard title="Movement alerts" icon={Mail}>
          <div className="space-y-3">
            <p className="text-sm leading-6 text-slate-600">
              After each analysis run, Answrdeck compares your latest results to the previous check.
              When visibility drops, competitors move ahead, or you gain ground on key engines, we
              email a concise summary with a link back to your dashboard.
            </p>
            {alertEmail ? (
              <p className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">
                Alerts go to <span className="font-semibold text-slate-900">{alertEmail}</span>
              </p>
            ) : (
              <p className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm text-amber-800">
                Add an email to your account to receive movement alerts.
              </p>
            )}
            <p className="text-xs text-slate-400">
              High-priority drops alert immediately. Other changes are bundled after a full project
              re-run. Requires server mail configuration (Resend or SMTP).
            </p>
          </div>
        </DashboardCard>
      </motion.div>

      {/* Settings form */}
      <motion.div variants={item}>
        <DashboardCard title="Workspace" icon={Settings}>
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Timezone
              </label>
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Default country
              </label>
              <input
                value={defaultCountry}
                onChange={(e) => setDefaultCountry(e.target.value)}
                placeholder="e.g. United States"
                className="w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button onClick={save}>
                <Save className="h-4 w-4" />
                Save settings
              </Button>
              {saved && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs font-medium text-emerald-600"
                >
                  Settings saved
                </motion.span>
              )}
            </div>
          </div>
        </DashboardCard>
      </motion.div>
    </motion.div>
  );
};

export default SettingsView;
