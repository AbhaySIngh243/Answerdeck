import React, { useState } from 'react';

const SettingsView = () => {
  const [timezone, setTimezone] = useState(localStorage.getItem('ranklore_timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [defaultCountry, setDefaultCountry] = useState(localStorage.getItem('ranklore_default_country') || '');

  const save = () => {
    localStorage.setItem('ranklore_timezone', timezone);
    localStorage.setItem('ranklore_default_country', defaultCountry);
    alert('Settings saved.');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
        <p className="text-neutral-500 mt-1">Configure workspace defaults for prompt analysis.</p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-6 space-y-4">
        <label className="block text-sm font-medium text-neutral-700">
          Timezone
          <input value={timezone} onChange={(event) => setTimezone(event.target.value)} className="mt-1 w-full border border-neutral-200 rounded-lg px-4 py-2" />
        </label>

        <label className="block text-sm font-medium text-neutral-700">
          Default Country
          <input value={defaultCountry} onChange={(event) => setDefaultCountry(event.target.value)} className="mt-1 w-full border border-neutral-200 rounded-lg px-4 py-2" placeholder="e.g. United States" />
        </label>

        <button onClick={save} className="bg-brand-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-secondary">Save Settings</button>
      </div>
    </div>
  );
};

export default SettingsView;