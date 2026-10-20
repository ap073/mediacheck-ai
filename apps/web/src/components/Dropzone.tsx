'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  Video,
  FileCheck,
  AlertCircle,
  X,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface DropzoneProps {
  onAnalyze: (file: File, type: 'image' | 'video') => void;
  isLoading: boolean;
  uploadProgress: number;
  statusMessage: string;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onAnalyze,
  isLoading,
  uploadProgress,
  statusMessage,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaMeta, setMediaMeta] = useState<{
    width?: number;
    height?: number;
    duration?: number;
  }>({});

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelection = (file: File) => {
    setError(null);

    const isImg = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.name);
    const isVid = file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name);

    if (!isImg && !isVid) {
      setError('Unsupported file type. Please upload a JPEG, PNG, WebP image or MP4, MOV, WebM video.');
      return;
    }

    const type = isImg ? 'image' : 'video';
    setMediaType(type);
    setSelectedFile(file);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Extract basic dimensions/duration in browser for instant user feedback
    if (type === 'image') {
      const img = new Image();
      img.onload = () => {
        setMediaMeta({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = url;
    } else {
      const vid = document.createElement('video');
      vid.preload = 'metadata';
      vid.onloadedmetadata = () => {
        setMediaMeta({ duration: vid.duration });
        if (vid.duration > 60) {
          setError(
            `Notice: This video is ${vid.duration.toFixed(1)}s long. Synchronous analysis has a documented limit of 60 seconds.`
          );
        }
      };
      vid.src = url;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleClear = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    setMediaMeta({});
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const triggerAnalyze = () => {
    if (!selectedFile) return;
    onAnalyze(selectedFile, mediaType);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Hidden native file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileSelection(e.target.files[0])}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileSelection(e.target.files[0])}
      />

      {/* Main Drag & Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-3xl border-2 border-dashed transition-all p-8 sm:p-10 text-center ${
          dragOver
            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[1.01]'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-slate-400 dark:hover:border-slate-600'
        } shadow-sm backdrop-blur-sm`}
      >
        {!selectedFile ? (
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900 shadow-inner">
              <UploadCloud className="w-10 h-10 animate-bounce" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                Drag & Drop your Image or Video here
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Supports high-resolution JPEG, PNG, WebP photos and MP4, MOV, WebM video clips under 60s.
              </p>
            </div>

            {/* Separate buttons for image and video upload */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Upload Image</span>
              </button>

              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 border border-slate-700"
              >
                <Video className="w-4 h-4" />
                <span>Upload Video</span>
              </button>
            </div>
          </div>
        ) : (
          /* Preview state */
          <div className="space-y-6">
            <div className="relative inline-block max-w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-black/5 dark:bg-black/40">
              <button
                onClick={handleClear}
                disabled={isLoading}
                aria-label="Remove file"
                className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-slate-900/75 hover:bg-slate-900 text-white shadow transition-transform hover:scale-110 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>

              {mediaType === 'image' && previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-80 mx-auto object-contain rounded-2xl"
                />
              ) : previewUrl ? (
                <video
                  src={previewUrl}
                  controls
                  className="max-h-80 mx-auto rounded-2xl"
                />
              ) : null}
            </div>

            {/* File info pill */}
            <div className="inline-flex flex-wrap items-center justify-center gap-3 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-medium">
              <span className="flex items-center space-x-1.5 truncate max-w-xs font-semibold text-slate-900 dark:text-white">
                <FileCheck className="w-4 h-4 text-indigo-500" />
                <span className="truncate">{selectedFile.name}</span>
              </span>
              <span>•</span>
              <span>{formatSize(selectedFile.size)}</span>
              {mediaMeta.width && mediaMeta.height && (
                <>
                  <span>•</span>
                  <span>
                    {mediaMeta.width} × {mediaMeta.height} px
                  </span>
                </>
              )}
              {mediaMeta.duration !== undefined && (
                <>
                  <span>•</span>
                  <span>{mediaMeta.duration.toFixed(1)} seconds</span>
                </>
              )}
            </div>

            {/* Error display */}
            {error && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-center space-x-2 text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Upload progress & status */}
            {isLoading && (
              <div className="space-y-3 max-w-md mx-auto pt-2">
                <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                  <span className="flex items-center space-x-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                    <span>{statusMessage || 'Analyzing media...'}</span>
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* "Check for AI" Action Button */}
            {!isLoading && (
              <div className="flex items-center justify-center space-x-4 pt-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Change Media
                </button>
                <button
                  type="button"
                  onClick={triggerAnalyze}
                  className="flex items-center space-x-2 px-7 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Check for AI</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
