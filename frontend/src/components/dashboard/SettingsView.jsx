import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save } from 'lucide-react';
import DashboardCard from './DashboardCard';
import { Button } from '../ui/button';

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const SettingsView = () => {
  const [timezone, setTimezone] = useState(
    localStorage.getItem('ranklore_timezone') ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      'UTC'
  );
  const [defaultCountry, setDefaultCountry] = useState(
    localStorage.getItem('ranklore_default_country') || ''
  );
  const [saved, setSaved] = useState(false);

  const save = () => {
    localStorage.setItem('ranklore_timezone', timezone);
    localStorage.setItem('ranklore_default_country', defaultCountry);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
