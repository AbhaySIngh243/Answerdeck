import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, CreditCard, Mail, Settings, Save } from 'lucide-react';
import DashboardCard from './DashboardCard';
import { Button } from '../ui/button';
import { api } from '../../lib/api';
import {
  PENDING_CASHFREE_PLAN_KEY,
  startSubscriptionCheckout,
} from '../../lib/subscriptionCheckout';
import {
  billingCurrency,
  billingCycleNote,
  formatPaymentMethods,
  formatPlanPrice,
  formatRenewalDate,
  formatSubscriptionStatus,
  isSandboxEnvironment,
  planAmountFromHealth,
} from '../../lib/billingDisplay';
import { useBillingPhonePrompt } from '../../hooks/useBillingPhonePrompt';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/toast';
import { SUPPORT_EMAIL_HELLO } from '../../lib/supportEmails';

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
  const { requestPhone, phoneDialog } = useBillingPhonePrompt();
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
  const [cancelBusy, setCancelBusy] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [timezone, setTimezone] = useState(
    localStorage.getItem('ranklore_timezone') ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      'UTC'
  );
  const [defaultCountry, setDefaultCountry] = useState(
    localStorage.getItem('ranklore_default_country') || ''
  );
  const [saved, setSaved] = useState(false);

  const currency = billingCurrency(billingHealth);
  const sandbox = isSandboxEnvironment(billingHealth);
  const paymentMethods = formatPaymentMethods(billingHealth?.payment_methods);
  const standardPrice = formatPlanPrice(planAmountFromHealth(billingHealth, 'standard'), currency);
  const proPrice = formatPlanPrice(planAmountFromHealth(billingHealth, 'pro'), currency);

  useEffect(() => {
    const billingParam = searchParams.get('billing');
    if (!billingParam) return;
    let cancelled = false;

    (async () => {
      if (billingParam === 'failed') {
        toast.error(
          'Payment not completed',
          sandbox
            ? 'Cashfree did not authorize the payment. Try again with UPI, card, net banking, or wallet.'
            : 'Your payment was not completed. Return to checkout and try again, or contact support if the issue persists.',
        );
      } else if (billingParam === 'return') {
        try {
          for (let attempt = 0; attempt < 6 && !cancelled; attempt += 1) {
            const synced = await api.syncBilling();
            await queryClient.invalidateQueries({ queryKey: ['billing', 'me'] });
            await queryClient.invalidateQueries({ queryKey: ['projects'] });
            if (synced?.plan && synced.plan !== 'free') {
              toast.success('Subscription active', 'Your plan limits are updated.');
              break;
            }
            if (attempt < 5) {
              await new Promise((r) => setTimeout(r, 2000));
            } else {
              toast.info(
                'Authorization pending',
                'Payment is still processing. Use Continue payment or refresh status in a moment.',
              );
            }
          }
        } catch (e) {
          if (!cancelled) {
            toast.error('Could not sync billing', e?.message || 'Refresh the page to retry.');
          }
        }
      }
      if (!cancelled) {
        const next = new URLSearchParams(searchParams);
        next.delete('billing');
        next.delete('cf_status');
        next.delete('plan');
        setSearchParams(next, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryClient, sandbox, searchParams, setSearchParams, toast]);

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
      try {
        sessionStorage.removeItem(PENDING_CASHFREE_PLAN_KEY);
      } catch {
        /* ignore */
      }
      const outcome = await startSubscriptionCheckout(planKey, {
        user,
        forceNew: true,
        onRequestPhone: requestPhone,
      });
      if (outcome === 'paid') {
        await api.syncBilling();
        queryClient.invalidateQueries({ queryKey: ['billing', 'me'] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        toast.success('Subscription active', 'We are refreshing your limits now.');
      } else if (outcome === 'redirected') {
        toast.info(
          'Opening Cashfree',
          `Complete payment (${paymentMethods}) on the next page.`,
        );
      } else if (outcome === 'dismissed') {
        toast.info('Checkout closed', 'Use Continue payment to reopen Cashfree checkout.');
      }
    } catch (e) {
      toast.error('Checkout failed', e?.message || 'Please try again.');
    } finally {
      setCheckoutBusy(null);
    }
  };

  const runCancel = async () => {
    setCancelBusy(true);
    try {
      await api.cancelBilling();
      await queryClient.invalidateQueries({ queryKey: ['billing', 'me'] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCancelConfirm(false);
      toast.success(
        'Plan will end after this period',
        renewalEnd
          ? `You keep access until ${renewalEnd}. Your plan will revert to Free after that.`
          : 'Access continues until the end of the current paid period.',
      );
    } catch (e) {
      toast.error('Could not cancel', e?.message || 'Please try again or contact support.');
    } finally {
      setCancelBusy(false);
    }
  };

  const planLabel =
    billing?.plan === 'pro' ? 'Pro' : billing?.plan === 'standard' ? 'Standard' : 'Free';

  const subStatus = (billing?.subscription?.status || '').toLowerCase();
  const checkoutPending = ['pending', 'initialized', 'created'].includes(subStatus);
  const checkoutFailed = subStatus === 'failed';
  const pendingPlanKey =
    billing?.subscription?.internal_plan === 'pro' ? 'pro' : 'standard';
  const pendingPlanPrice =
    pendingPlanKey === 'pro' ? proPrice : standardPrice;
  const activePlanPrice =
    billing?.plan === 'pro' ? proPrice : billing?.plan === 'standard' ? standardPrice : null;
  const renewalEnd = formatRenewalDate(billing?.subscription?.current_period_end);
  const hasPaidPlan = billing?.plan === 'standard' || billing?.plan === 'pro';
  const checkoutUnavailable = Boolean(billingHealth && !billingHealth.ready_for_checkout);
  const checkoutDisabled = Boolean(checkoutBusy || checkoutUnavailable);
  const showDevBillingBanner =
    sandbox && checkoutUnavailable;
  const showLiveBillingUnavailable = !sandbox && checkoutUnavailable;

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
      {phoneDialog}

      {/* Header */}
      <motion.div variants={item} className="border-b border-slate-200/60 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Configure workspace defaults for prompt analysis.</p>
      </motion.div>

      <motion.div variants={item}>
        <DashboardCard title="Plan & billing" icon={CreditCard}>
          {showDevBillingBanner ? (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <p className="font-semibold">Payments are temporarily unavailable</p>
                <p>
                  We could not start secure checkout right now. Please email{' '}
                  <a href={`mailto:${SUPPORT_EMAIL_HELLO}`} className="font-semibold underline">
                    {SUPPORT_EMAIL_HELLO}
                  </a>{' '}
                  and we will help you activate the plan.
                </p>
              </div>
            </div>
          ) : null}

          {showLiveBillingUnavailable ? (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <p className="font-semibold">Payments are temporarily unavailable</p>
                <p>
                  We could not start secure checkout right now. Please email{' '}
                  <a href={`mailto:${SUPPORT_EMAIL_HELLO}`} className="font-semibold underline">
                    {SUPPORT_EMAIL_HELLO}
                  </a>{' '}
                  and we will help you activate the plan.
                </p>
              </div>
            </div>
          ) : null}

          {billingLoading ? (
            <p className="text-sm text-slate-400">Loading plan...</p>
          ) : (
            <div className="space-y-4 text-sm text-slate-600">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current plan</p>
                <p className="mt-1 font-semibold text-slate-900">{planLabel}</p>
                {activePlanPrice ? (
                  <p className="mt-0.5 text-sm text-slate-600">
                    {activePlanPrice}
                    <span className="text-slate-400">/month</span>
                    {renewalEnd ? (
                      <span className="text-slate-500">
                        {' '}
                        - Access until {renewalEnd}
                      </span>
                    ) : null}
                  </p>
                ) : null}
                {billing?.limits ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Up to {billing.limits.max_projects} project
                    {billing.limits.max_projects === 1 ? '' : 's'} - {billing.limits.max_prompts_per_project} prompts
                    per project
                  </p>
                ) : null}
                {billing?.subscription?.status ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Status:{' '}
                    <span className="font-medium text-slate-700">
                      {formatSubscriptionStatus(billing.subscription.status)}
                    </span>
                    {checkoutPending ? (
                      <span className="text-amber-700">
                        {' '}
                        - complete payment to unlock paid limits.
                      </span>
                    ) : null}
                    {checkoutFailed ? (
                      <span className="text-red-600">
                        {' '}
                        - payment failed. Try again when ready.
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>

              {checkoutPending ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                  <p className="font-semibold">Complete payment on Cashfree</p>
                  <p className="mt-1 leading-relaxed">
                    Your {pendingPlanKey === 'pro' ? 'Pro' : 'Standard'} order ({pendingPlanPrice}) is awaiting
                    payment. Continue to Cashfree&apos;s secure checkout to pay with {paymentMethods}.
                  </p>
                  {sandbox && import.meta.env.DEV ? (
                    <p className="mt-2 leading-relaxed">
                      <span className="font-medium">Sandbox test:</span>{' '}
                      {currency === 'INR' ? (
                        <>
                          choose <strong>UPI</strong> and enter{' '}
                          <code className="rounded bg-amber-100 px-1">testsuccess@gocash</code>, or use test card OTP{' '}
                          <code className="rounded bg-amber-100 px-1">111000</code>.
                        </>
                      ) : (
                        <>
                          USD checkout is <strong>card only</strong> (Cashfree does not offer UPI for USD). For UPI
                          testing, set <code className="rounded bg-amber-100 px-1">CASHFREE_PLAN_CURRENCY=INR</code>{' '}
                          on the server and restart.
                        </>
                      )}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={checkoutDisabled}
                      onClick={() => runUpgrade(pendingPlanKey)}
                    >
                      {checkoutBusy ? 'Opening...' : 'Continue payment'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={checkoutBusy}
                      onClick={async () => {
                        try {
                          await api.syncBilling();
                          queryClient.invalidateQueries({ queryKey: ['billing', 'me'] });
                          toast.info('Status refreshed', 'Check if your plan updated.');
                        } catch (e) {
                          toast.error('Sync failed', e?.message || 'Try again.');
                        }
                      }}
                    >
                      Refresh status
                    </Button>
                  </div>
                </div>
              ) : null}

              {checkoutFailed && billing?.plan === 'free' ? (
                <div className="rounded-lg border border-red-200 bg-red-50/80 p-3 text-xs text-red-900">
                  <p className="font-semibold">Payment failed</p>
                  <p className="mt-1 leading-relaxed">
                    Cashfree did not complete the last payment. Start a fresh secure checkout when you are ready.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3"
                    disabled={checkoutDisabled}
                    onClick={() => runUpgrade(pendingPlanKey)}
                  >
                    {checkoutBusy ? 'Opening...' : `Try ${pendingPlanKey === 'pro' ? 'Pro' : 'Standard'} again`}
                  </Button>
                </div>
              ) : null}

              {billing?.plan === 'free' && !checkoutPending && !checkoutFailed ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={checkoutDisabled}
                      onClick={() => runUpgrade('standard')}
                    >
                      {checkoutBusy === 'standard' ? 'Opening...' : `Upgrade - Standard (${standardPrice}/mo)`}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={checkoutDisabled}
                      onClick={() => runUpgrade('pro')}
                    >
                      {checkoutBusy === 'pro' ? 'Opening...' : `Upgrade - Pro (${proPrice}/mo)`}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" asChild>
                      <Link to="/#pricing">View pricing</Link>
                    </Button>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">
                    Secure checkout via Cashfree ({paymentMethods}). {billingCycleNote(currency)}
                  </p>
                </div>
              ) : null}

              {hasPaidPlan && !checkoutPending ? (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/50 p-3 text-xs text-emerald-900">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p className="leading-relaxed">
                      Your plan is active for 30 days from payment. This is a one-time monthly payment; renew from Settings when it expires.
                      {renewalEnd ? ` Access until ${renewalEnd}.` : ''}
                    </p>
                  </div>

                  {!showCancelConfirm ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={cancelBusy}
                        onClick={() => setShowCancelConfirm(true)}
                      >
                        End after this period
                      </Button>
                      <Button type="button" size="sm" variant="ghost" asChild>
                        <Link to="/#pricing">Compare plans</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-700">
                      <p className="font-semibold text-slate-900">End this plan after the paid period?</p>
                      <p className="mt-1 leading-relaxed">
                        {renewalEnd
                          ? `You keep ${planLabel} access until ${renewalEnd}. After that, revert to Free unless you pay again.`
                          : 'Your plan will stay active until the end of the current period, then revert to Free.'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={cancelBusy}
                          onClick={runCancel}
                        >
                          {cancelBusy ? 'Updating...' : 'Yes, end after this period'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={cancelBusy}
                          onClick={() => setShowCancelConfirm(false)}
                        >
                          Keep plan active
                        </Button>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-slate-500">
                    To switch plans (for example, Standard to Pro), end the current paid period first or email{' '}
                    <a href={`mailto:${SUPPORT_EMAIL_HELLO}`} className="font-medium text-brand-primary hover:underline">
                      {SUPPORT_EMAIL_HELLO}
                    </a>
                    .
                  </p>
                </div>
              ) : null}
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
