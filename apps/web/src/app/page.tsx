'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { Dropzone } from '../components/Dropzone';
import { ResultsDashboard } from '../components/ResultsDashboard';
import { PrivacyNotice } from '../components/PrivacyNotice';
import { ExtensionModal } from '../components/ExtensionModal';
import { fetchProviderStatus, uploadAndAnalyzeMedia } from '../services/api';
import { DetectionResult, ProviderStatus } from '../types/detection';
import { Sparkles, Shield, Cpu, Info, CheckCircle2 } from 'lucide-react';

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [scanResult, setScanResult] = useState<DetectionResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize theme from preference
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(isDark);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Load provider health status on mount
  useEffect(() => {
    fetchProviderStatus().then(setProviderStatus);
  }, []);

  const handleToggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const handleAnalyze = async (file: File, type: 'image' | 'video') => {
    setErrorMessage(null);
    setIsLoading(true);
    setUploadProgress(10);
    setStatusMessage('Preparing and uploading file...');

    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    try {
      const result = await uploadAndAnalyzeMedia(file, type, (pct) => {
        setUploadProgress(pct);
        if (pct < 90) {
          setStatusMessage(`Uploading media (${pct}%)...`);
        } else {
          setStatusMessage('Sightengine AI detector analyzing neural patterns...');
        }
      });

      setScanResult(result);
      setStatusMessage('Analysis complete!');
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during detection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setScanResult(null);
    setErrorMessage(null);
    setUploadProgress(0);
    setStatusMessage('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors">
      <Navbar
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        providerStatus={providerStatus}
        onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        {!scanResult ? (
          <>
            {/* Hero Section */}
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Next-Gen Deepfake & Synthetic Media Detection</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Is This Image or Video <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500 bg-clip-text text-transparent">
                  AI-Generated?
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                MediaCheck AI analyzes subtle visual artifacts, structural frequency patterns,
                and digital provenance to uncover synthetic images from Midjourney, DALL-E, Stable
                Diffusion, Sora, Runway, and generative video tools.
              </p>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="max-w-2xl mx-auto p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs sm:text-sm font-medium flex items-start space-x-3">
                <Info className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <strong className="block font-bold">Analysis Notice:</strong>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Upload & Dropzone Area */}
            <Dropzone
              onAnalyze={handleAnalyze}
              isLoading={isLoading}
              uploadProgress={uploadProgress}
              statusMessage={statusMessage}
            />

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto pt-6">
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Neural Artifact Detection
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Evaluates frequency anomalies, texture synthesis footprints, and generator-specific signatures.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
                <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  C2PA Provenance Inspection
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Verifies Content Credentials (C2PA) and JUMBF manifests to cross-check asset provenance records.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Calibrated Probabilities
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Reports clear categories and confidence intervals without fabricating certainty or false binaries.
                </p>
              </div>
            </div>

            {/* Privacy Section */}
            <PrivacyNotice />
          </>
        ) : (
          /* Results Dashboard View */
          <ResultsDashboard
            result={scanResult}
            filePreviewUrl={previewUrl}
            onReset={handleReset}
          />
        )}
      </main>

      {/* Chrome Extension Instructions Modal */}
      <ExtensionModal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
      />

      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
        <p>© 2026 MediaCheck AI. Built with Next.js, Python FastAPI, and Sightengine AI detection.</p>
      </footer>
    </div>
  );
}
