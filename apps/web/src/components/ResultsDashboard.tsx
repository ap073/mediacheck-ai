'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  Cpu,
  Info,
  ShieldAlert,
  FileText,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { DetectionResult } from '../types/detection';

interface ResultsDashboardProps {
  result: DetectionResult;
  filePreviewUrl?: string | null;
  onReset: () => void;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  result,
  filePreviewUrl,
  onReset,
}) => {
  const getCategoryConfig = () => {
    switch (result.category) {
      case 'AI-generated signals detected':
        return {
          title: 'AI-Generated Signals Detected',
          badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900',
          bannerClass: 'bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-transparent border-rose-300/50 dark:border-rose-800/60',
          icon: <ShieldAlert className="w-8 h-8 text-rose-500 animate-pulse-subtle" />,
          accentColor: 'text-rose-600 dark:text-rose-400',
          barColor: 'bg-rose-500',
        };
      case 'No AI-generated signals detected':
        return {
          title: 'No AI-Generated Signals Detected',
          badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
          bannerClass: 'bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-300/50 dark:border-emerald-800/60',
          icon: <CheckCircle2 className="w-8 h-8 text-emerald-500" />,
          accentColor: 'text-emerald-600 dark:text-emerald-400',
          barColor: 'bg-emerald-500',
        };
      case 'Inconclusive':
      default:
        return {
          title: 'Inconclusive / Mixed Signals',
          badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
          bannerClass: 'bg-gradient-to-r from-slate-500/10 via-indigo-500/5 to-transparent border-slate-300/60 dark:border-slate-700',
          icon: <HelpCircle className="w-8 h-8 text-indigo-500" />,
          accentColor: 'text-indigo-600 dark:text-indigo-400',
          barColor: 'bg-indigo-500',
        };
    }
  };

  const config = getCategoryConfig();
  const percentage = result.score_percentage !== null ? result.score_percentage : 0;
  const hasGenerators = result.generator_scores && Object.keys(result.generator_scores).length > 0;
  const hasFrames = result.frames_summary && result.frames_summary.length > 0;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Banner Result Card */}
      <div className={`p-6 sm:p-8 rounded-3xl border ${config.bannerClass} backdrop-blur-sm shadow-sm`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-md border border-slate-100 dark:border-slate-800 flex-shrink-0">
              {config.icon}
            </div>
            <div>
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border mb-2 uppercase tracking-wider">
                <span className={config.badgeClass}>{result.category}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {config.title}
              </h2>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">
                {result.confidence_label}
              </p>
            </div>
          </div>

          {/* Score Gauge / Percentage Badge */}
          {result.score !== null && (
            <div className="flex-shrink-0 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center min-w-[140px]">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                AI Signal Score
              </span>
              <div className="text-3xl sm:text-4xl font-black mt-1 text-slate-900 dark:text-white">
                {percentage}%
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Raw: {result.score.toFixed(3)}
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                <div
                  className={`h-2 rounded-full ${config.barColor} transition-all duration-700 ease-out`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Explanation text */}
        <div className="mt-6 pt-6 border-t border-slate-200/60 dark:border-slate-700/60">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            {result.explanation}
          </p>
        </div>
      </div>

      {/* Main Grid: Media Preview + Diagnostic Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Media Preview + Metadata */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              <span>Submitted Media</span>
            </h3>

            {/* Media thumbnail / player */}
            <div className="rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-72 border border-slate-200 dark:border-slate-800">
              {result.file_info.media_type === 'image' && filePreviewUrl ? (
                <img
                  src={filePreviewUrl}
                  alt={result.file_info.filename}
                  className="max-h-72 w-full object-contain"
                />
              ) : filePreviewUrl ? (
                <video
                  src={filePreviewUrl}
                  controls
                  className="max-h-72 w-full"
                />
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  Preview not retained (processed securely)
                </div>
              )}
            </div>

            {/* Metadata table */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              <div className="py-2 flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Filename:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                  {result.file_info.filename}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">File Size:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {result.file_info.file_size_formatted}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">MIME Type:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {result.file_info.mime_type}
                </span>
              </div>
              {result.file_info.width && result.file_info.height && (
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Dimensions:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {result.file_info.width} × {result.file_info.height} px
                  </span>
                </div>
              )}
              {result.file_info.duration_seconds && (
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Duration:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {result.file_info.duration_seconds.toFixed(1)} seconds
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: AI Model Breakdown, Provenance, Limitations */}
        <div className="lg:col-span-7 space-y-6">
          {/* Provider & Model Specs */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-indigo-500" />
              <span>Detection Provider & Pipeline</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 block mb-1">Provider Engine</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {result.provider}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 block mb-1">Analysis Model</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {result.method}
                </span>
              </div>
            </div>

            {/* Generator-specific breakdown if returned */}
            {hasGenerators && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                  <span>Generator Model Signatures:</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {Object.entries(result.generator_scores).map(([genName, genScore]) => (
                    <div
                      key={genName}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60"
                    >
                      <span className="capitalize text-[11px] font-medium text-slate-500 dark:text-slate-400 block truncate">
                        {genName}
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {(genScore * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Video Timeline Frame Breakdown if video */}
            {hasFrames && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Sampled Keyframes Analysis:</span>
                  </span>
                  {result.peak_frame_score && (
                    <span className="text-slate-500 text-[11px]">
                      Peak: {(result.peak_frame_score * 100).toFixed(1)}%
                    </span>
                  )}
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {result.frames_summary!.map((frame, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs"
                    >
                      <span className="text-slate-500 font-mono">
                        {frame.position_seconds.toFixed(1)}s
                      </span>
                      <div className="flex items-center space-x-3 w-1/2">
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              frame.score >= 0.65 ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(frame.score * 100, 100)}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px] min-w-[35px] text-right">
                          {(frame.score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Media Provenance / C2PA Box */}
          {result.provenance && (
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-violet-500" />
                <span>Media Provenance & Content Credentials (C2PA)</span>
              </h3>

              <div
                className={`p-3.5 rounded-2xl border text-xs ${
                  result.provenance.has_credentials
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2 font-bold mb-1">
                  <span>Status:</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/70 dark:bg-slate-900/70 border text-[11px]">
                    {result.provenance.status}
                  </span>
                </div>
                <p className="mt-1 leading-relaxed">{result.provenance.summary}</p>
              </div>

              {/* Disclaimer */}
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
                <span>{result.provenance.disclaimer}</span>
              </div>
            </div>
          )}

          {/* Limitations Notice */}
          <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <Info className="w-4 h-4 text-slate-400" />
              <span>Analysis Limitations & Responsible Interpretation</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
              {result.limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
              <li>
                Never claim a human captured a file based solely on the absence of AI signals.
              </li>
            </ul>
          </div>

          {/* Action Reset Button */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={onReset}
              className="flex items-center space-x-2 px-6 py-3 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white shadow-md transition-all hover:scale-105 active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Scan Another File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
