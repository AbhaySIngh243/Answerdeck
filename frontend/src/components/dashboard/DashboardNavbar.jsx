import React, { useMemo } from 'react';
import { UserButton } from '@clerk/react';
import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { clerkAppearance } from '../../lib/clerkAppearance';
import { Button } from '../ui/button';

function clerkPrimaryEmail(u) {
  if (!u) return '';
  return (
    u.primaryEmailAddress?.emailAddress ??
    u.emailAddresses?.[0]?.emailAddress ??
    ''
  );
}

function clerkDisplayName(u) {
  if (!u) return '';
  const full = u.fullName?.trim();
  if (full) return full;
  const parts = [u.firstName, u.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return u.username?.trim() ?? '';
}

export default function DashboardNavbar({ onMenuClick, onSignOut }) {
  const { user, loading } = useAuth();
  const email = useMemo(() => clerkPrimaryEmail(user), [user]);
  const displayName = useMemo(() => clerkDisplayName(user), [user]);

  const userButtonAppearance = useMemo(
    () => ({
      ...clerkAppearance,
      elements: {
        ...clerkAppearance.elements,
        userButtonAvatarBox: 'h-8 w-8 ring-2 ring-slate-100/80',
        userButtonTrigger: 'rounded-full ring-2 ring-slate-100/80 focus:shadow-none',
      },
    }),
    []
  );

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200/60 bg-white/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open menu"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Dashboard
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden flex-col items-end text-right sm:flex">
          <span className="max-w-[12rem] truncate text-xs font-semibold text-slate-800">
            {loading ? 'Loading...' : displayName || email || 'Signed in'}
          </span>
          {displayName && email && (
            <span className="max-w-[12rem] truncate text-[10px] text-slate-400">
              {email}
            </span>
          )}
        </div>
        <UserButton afterSignOutUrl="/" appearance={userButtonAppearance} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onSignOut}
          title="Sign out"
          className="text-slate-400 hover:text-slate-600"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
