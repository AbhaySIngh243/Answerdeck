import React, { useState } from 'react';

const SettingsView = () => {
  const [timezone, setTimezone] = useState(
    localStorage.getItem('ranklore_timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [defaultCountry, setDefaultCountry] = useState(localStorage.getItem('ranklore_default_country') || '');

  const save = () => {
    localStorage.setItem('ranklore_timezone', timezone);
    localStorage.setItem('ranklore_default_country', defaultCountry);
    alert('Settings saved.');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="landing-eyebrow text-left">Account</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#0f172a]">Settings</h1>
        <p className="mt-1 text-[#64748b]">Configure workspace defaults for prompt analysis.</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-slate-800">
          Timezone
          <input
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="mt-1 w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5 text-[#0f172a] outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </label>

        <label className="block text-sm font-medium text-slate-800">
          Default country
          <input
            value={defaultCountry}
            onChange={(event) => setDefaultCountry(event.target.value)}
            className="mt-1 w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5 text-[#0f172a] outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            placeholder="e.g. United States"
          />
        </label>

        <button
          type="button"
          onClick={save}
          className="rounded-xl bg-brand-primary px-5 py-2.5 font-semibold text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-[#3b82f6]"
        >
          Save settings
        </button>
      </div>
    </div>
  );
};

export default SettingsView;
