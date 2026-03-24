import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { SignIn } from '@clerk/react';
import { useAuth } from '../../contexts/AuthContext';
import { clerkAppearance } from '../../lib/clerkAppearance';
import BrandLogo from '../BrandLogo';

const LoginPage = () => {
  const { isSignedIn, loading } = useAuth();

  if (!loading && isSignedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f8fafc] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex justify-center">
            <BrandLogo variant="lockup" size="lg" />
          </Link>
        </div>
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-[var(--shadow-premium)]">
          <SignIn
            routing="path"
            path="/login"
            signUpUrl="/signup"
            forceRedirectUrl="/dashboard"
            fallbackRedirectUrl="/dashboard"
            appearance={clerkAppearance}
          />
          <p className="mt-4 text-center text-sm text-[#64748b]">
            Need an account?{' '}
            <Link to="/signup" className="font-semibold text-brand-primary hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

