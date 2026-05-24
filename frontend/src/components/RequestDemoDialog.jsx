import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarCheck, Loader2, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { api } from '../lib/api';

const initialForm = {
  name: '',
  email: '',
  company: '',
  role: '',
  message: '',
};

export default function RequestDemoDialog({ open, onOpenChange }) {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMessage, setErrorMessage] = useState('');

  const update = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (status === 'error') setStatus('idle');
  };

  const resetAndClose = () => {
    onOpenChange(false);
    window.setTimeout(() => {
      setForm(initialForm);
      setStatus('idle');
      setErrorMessage('');
    }, 220);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage('');
    try {
      await api.submitDemoRequest({
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        role: form.role.trim(),
        message: form.message.trim(),
      });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAndClose();
        else onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg overflow-hidden border-brand-primary/15 p-0 sm:max-w-lg">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-brand-primary/[0.08] to-transparent"
          aria-hidden
        />
        <div className="relative p-6 sm:p-7">
          <DialogHeader className="mb-5">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl tracking-tight">Request a demo</DialogTitle>
            <DialogDescription className="text-[15px] leading-relaxed text-slate-500">
              See how Answrdeck tracks your brand across AI engines and turns gaps into a clear action plan.
              We&apos;ll reach out within one business day.
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {status === 'success' ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-5 py-8 text-center"
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CalendarCheck className="h-6 w-6" />
                </div>
                <p className="text-base font-semibold text-slate-900">Request sent</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Thanks — we sent your details to{' '}
                  <span className="font-medium text-slate-800">hello@answerdeck.com</span>. Check your inbox for a reply
                  soon.
                </p>
                <Button type="button" className="mt-6 w-full" onClick={resetAndClose}>
                  Done
                </Button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="text-xs font-semibold text-slate-600">Full name</span>
                    <Input
                      required
                      value={form.name}
                      onChange={update('name')}
                      placeholder="Jane Doe"
                      autoComplete="name"
                      disabled={status === 'submitting'}
                    />
                  </label>
                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="text-xs font-semibold text-slate-600">Work email</span>
                    <Input
                      required
                      type="email"
                      value={form.email}
                      onChange={update('email')}
                      placeholder="you@company.com"
                      autoComplete="email"
                      disabled={status === 'submitting'}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-600">Company</span>
                    <Input
                      required
                      value={form.company}
                      onChange={update('company')}
                      placeholder="Acme Inc."
                      autoComplete="organization"
                      disabled={status === 'submitting'}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-600">Role (optional)</span>
                    <Input
                      value={form.role}
                      onChange={update('role')}
                      placeholder="Head of Marketing"
                      autoComplete="organization-title"
                      disabled={status === 'submitting'}
                    />
                  </label>
                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="text-xs font-semibold text-slate-600">What should we cover? (optional)</span>
                    <Textarea
                      value={form.message}
                      onChange={update('message')}
                      placeholder="Your category, competitors, or what you want to improve in AI answers…"
                      rows={3}
                      disabled={status === 'submitting'}
                      className="min-h-[88px] resize-y"
                    />
                  </label>
                </div>

                {status === 'error' && errorMessage ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                    {errorMessage}
                  </p>
                ) : null}

                <Button type="submit" className="w-full" size="lg" disabled={status === 'submitting'}>
                  {status === 'submitting' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    'Request demo'
                  )}
                </Button>
                <p className="text-center text-[11px] text-slate-400">
                  By submitting, you agree we may contact you about Answrdeck. No spam.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
