import React from 'react';
import { Lock, EyeOff, Server, ShieldCheck } from 'lucide-react';

export const PrivacyNotice: React.FC = () => {
  return (
    <div className="w-full max-w-4xl mx-auto mt-16 p-6 rounded-3xl bg-slate-100/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs">
      <div className="flex items-center space-x-2 font-bold text-slate-800 dark:text-slate-200 mb-3">
        <Lock className="w-4 h-4 text-indigo-500" />
        <span className="text-sm">Privacy & Processing Transparency</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex items-start space-x-2.5">
          <EyeOff className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-slate-700 dark:text-slate-300">Zero Retention:</strong> Uploaded media is processed in transient memory or secure temporary files and immediately deleted after analysis.
          </p>
        </div>

        <div className="flex items-start space-x-2.5">
          <Server className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-slate-700 dark:text-slate-300">Provider Processing:</strong> Media bytes are securely routed to the configured Sightengine AI detection API and processed under Sightengine’s service terms.
          </p>
        </div>

        <div className="flex items-start space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-slate-700 dark:text-slate-300">Confidentiality:</strong> Files are never stored in a public bucket, never logged to server disk, and never used to train public models.
          </p>
        </div>
      </div>
    </div>
  );
};
