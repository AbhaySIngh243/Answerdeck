/** Light Answrdeck styling for Clerk (SignIn / SignUp / UserButton popover). */
export const clerkAppearance = {
  variables: {
    fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
    colorPrimary: '#2563eb',
    colorBackground: '#ffffff',
    colorText: '#0f172a',
    colorTextSecondary: '#475569',
    colorInputBackground: '#f8fafc',
    colorNeutral: '#e2e8f0',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'mx-auto w-full',
    card: 'shadow-[0_20px_50px_rgba(15,23,42,0.08)] border border-[#e2e8f0]',
    headerTitle: 'text-[#0f172a]',
    headerSubtitle: 'text-[#64748b]',
    formButtonPrimary:
      'bg-[#2563eb] hover:bg-[#3b82f6] text-white shadow-md shadow-blue-500/20 rounded-xl',
    socialButtonsBlockButton: 'border-[#e2e8f0] rounded-xl',
    formFieldInput: 'border-[#e2e8f0] rounded-xl bg-[#f8fafc]',
    footerActionLink: 'text-[#2563eb]',
    identityPreviewText: 'text-[#0f172a]',
    formFieldLabel: 'text-[#334155]',

    /* UserButton dropdown — default theme made action rows nearly white-on-white */
    userButtonPopoverCard: 'bg-white border border-[#e2e8f0] shadow-xl',
    userButtonPopoverMain: 'text-[#0f172a]',
    userButtonPopoverActions: 'text-[#0f172a]',
    userButtonPopoverActionButton:
      '!text-[#0f172a] hover:!bg-slate-100 focus:!bg-slate-100 [&_svg]:!text-[#64748b]',
    userButtonPopoverActionButtonText: '!text-[#0f172a] !font-medium',
    userButtonPopoverActionButtonIconBox: '!text-[#64748b]',
    userButtonPopoverFooter: 'text-[#64748b] border-t border-[#e2e8f0]',
    userPreviewMainIdentifier: 'text-[#0f172a] font-semibold',
    userPreviewSecondaryIdentifier: 'text-[#64748b]',
    userPreviewTextContainer: 'text-[#0f172a]',
    userButtonAvatarBox: 'ring-2 ring-slate-100',
    userButtonTrigger: 'rounded-2xl focus:shadow-none',
  },
};
