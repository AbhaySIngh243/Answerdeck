import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { SignUp } from '@clerk/react';
import { useAuth } from '../../contexts/AuthContext';
import { clerkAppearance } from '../../lib/clerkAppearance';
import BrandLogo from '../BrandLogo';

const SignupPage = () => {
  const { isSignedIn, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f8fafc]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-primary" />
      </div>
    );
  }

  if (isSignedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f8fafc] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex justify-center">
            <BrandLogo variant="lockup" size="lg" />
          </Link>
          <p className="mt-3 text-sm text-[#64748b]">
            Create your free account. No card required.
          </p>
        </div>
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-[var(--shadow-premium)]">
          <SignUp
            routing="path"
            path="/signup"
            signInUrl="/login"
            forceRedirectUrl="/dashboard"
            fallbackRedirectUrl="/dashboard"
            appearance={clerkAppearance}
          />
          <p className="mt-4 text-center text-sm text-[#64748b]">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-brand-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
        <p className="mt-5 text-center text-xs leading-relaxed text-[#94a3b8]">
          By creating an account you agree to our{' '}
          <Link to="/terms" className="font-medium text-[#64748b] hover:underline">Terms</Link>{' '}
          and{' '}
          <Link to="/privacy" className="font-medium text-[#64748b] hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
};

export default SignupPage;

