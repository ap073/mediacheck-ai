'use client';

import React from 'react';
import { Chrome, X, CheckCircle, Terminal, ExternalLink } from 'lucide-react';

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExtensionModal: React.FC<ExtensionModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-5 text-slate-800 dark:text-slate-200">
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
            <Chrome className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">MediaCheck AI Chrome Extension</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Analyze web images on right-click or upload files directly
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs leading-relaxed">
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            How to install the extension in Google Chrome:
          </p>

          <ol className="space-y-2 list-decimal list-inside text-slate-600 dark:text-slate-400">
            <li>
              Build the extension bundle:
              <div className="mt-1 p-2 rounded-lg bg-slate-950 font-mono text-emerald-400 text-[11px] overflow-x-auto">
                cd apps/extension && npm run build
              </div>
            </li>
            <li>
              Open Google Chrome and navigate to <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">chrome://extensions</code>
            </li>
            <li>
              Toggle on <strong className="text-slate-800 dark:text-slate-200">Developer mode</strong> in the top-right corner.
            </li>
            <li>
              Click <strong className="text-slate-800 dark:text-slate-200">Load unpacked</strong> and select the directory:
              <div className="mt-1 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-200 text-[11px] overflow-x-auto">
                apps/extension/dist
              </div>
            </li>
          </ol>
        </div>

        <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-xs text-indigo-900 dark:text-indigo-300 flex items-start space-x-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0 text-indigo-500 mt-0.5" />
          <span>
            Once loaded, right-click any image on the web and choose <strong>"Check image with MediaCheck AI"</strong>.
          </span>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
