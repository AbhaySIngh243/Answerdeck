import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from './BrandLogo';

const navLinks = [
  { href: '#features', label: 'Product' },
  { href: '#how-it-works', label: 'Solutions' },
  { href: '#pricing', label: 'Pricing' },
];

const Navbar = () => {
  const { isSignedIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/');
  };

  const closeMenu = () => setMenuOpen(false);

  const sheetTop = 'max(4.25rem, calc(3.5rem + env(safe-area-inset-top, 0px)))';

  return (
    <>
      <nav
        className={`sticky top-0 z-50 w-full border-b border-[#e2e8f0] backdrop-blur-xl transition-[box-shadow,background-color] duration-300 supports-[backdrop-filter]:bg-white/75 ${
          scrolled ? 'bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.06),0_8px_24px_-8px_rgba(15,23,42,0.08)]' : 'bg-white/85'
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 pt-[env(safe-area-inset-top,0px)] sm:px-6 lg:px-8">
          <div className="flex h-14 min-h-[3.5rem] items-center justify-between gap-3 sm:h-[4.5rem]">
            <BrandLogo to="/" variant="lockup" size="nav" className="min-w-0 shrink-0" onClick={closeMenu} />

            <div className="hidden items-center gap-10 text-sm font-medium text-[#64748b] md:flex">
              {navLinks.map(({ href, label }) => (
                <a key={href} href={href} className="transition-colors hover:text-brand-primary">
                  {label}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {isSignedIn ? (
                <>
                  <Link
                    to="/dashboard"
                    className="hidden text-sm font-medium text-[#64748b] transition-colors hover:text-brand-primary sm:block"
                  >
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="touch-manipulation rounded-full border border-[#e2e8f0] px-3 py-2 text-sm font-medium text-[#0f172a] transition-colors hover:bg-[#f8fafc] sm:px-4"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="hidden text-sm font-medium text-[#64748b] transition-colors hover:text-brand-primary md:block"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    className="touch-manipulation rounded-full bg-[#0f172a] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-black sm:px-5"
                  >
                    Get Started
                  </Link>
                </>
              )}

              <button
                type="button"
                className="touch-manipulation rounded-lg p-2 text-[#0f172a] hover:bg-slate-100 md:hidden"
                aria-expanded={menuOpen}
                aria-controls="mobile-nav-menu"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                onClick={() => setMenuOpen((o) => !o)}
              >
                {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[100] touch-manipulation bg-slate-900/40 md:hidden"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <div
            id="mobile-nav-menu"
            className="fixed inset-x-0 bottom-0 z-[110] flex flex-col overflow-hidden border-t border-[#e2e8f0] bg-white shadow-[0_-8px_30px_rgba(15,23,42,0.08)] md:hidden"
            style={{
              top: sheetTop,
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain px-4 py-4">
              {navLinks.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  className="touch-manipulation rounded-xl px-4 py-3.5 text-base font-medium text-[#334155] active:bg-slate-100"
                  onClick={closeMenu}
                >
                  {label}
                </a>
              ))}
              {!isSignedIn ? (
                <>
                  <Link
                    to="/login"
                    className="touch-manipulation rounded-xl px-4 py-3.5 text-base font-medium text-[#334155] active:bg-slate-100"
                    onClick={closeMenu}
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    className="touch-manipulation mt-2 rounded-xl bg-brand-primary py-3.5 text-center text-base font-semibold text-white active:bg-[#1d4ed8]"
                    onClick={closeMenu}
                  >
                    Get Started
                  </Link>
                </>
              ) : (
                <Link
                  to="/dashboard"
                  className="touch-manipulation rounded-xl px-4 py-3.5 text-base font-medium text-[#334155] active:bg-slate-100 sm:hidden"
                  onClick={closeMenu}
                >
                  Dashboard
                </Link>
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
};

export default Navbar;
