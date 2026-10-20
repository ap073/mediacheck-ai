import { DetectionResult, ExtensionSettings } from './types';

// Elements
const backendStatus = document.getElementById('backend-status') as HTMLSpanElement;
const btnSettingsToggle = document.getElementById('btn-settings-toggle') as HTMLButtonElement;
const settingsPane = document.getElementById('settings-pane') as HTMLDivElement;
const inputApiUrl = document.getElementById('input-api-url') as HTMLInputElement;
const btnSaveSettings = document.getElementById('btn-save-settings') as HTMLButtonElement;

const btnPickImage = document.getElementById('btn-pick-image') as HTMLButtonElement;
const btnPickVideo = document.getElementById('btn-pick-video') as HTMLButtonElement;
const fileInputImage = document.getElementById('file-input-image') as HTMLInputElement;
const fileInputVideo = document.getElementById('file-input-video') as HTMLInputElement;

const selectedCapsule = document.getElementById('selected-file-capsule') as HTMLDivElement;
const capsuleName = document.getElementById('capsule-name') as HTMLSpanElement;
const btnCapsuleClear = document.getElementById('btn-capsule-clear') as HTMLButtonElement;

const btnCheckAi = document.getElementById('btn-check-ai') as HTMLButtonElement;
const loadingState = document.getElementById('loading-state') as HTMLDivElement;
const errorBanner = document.getElementById('error-banner') as HTMLDivElement;
const errorMessage = document.getElementById('error-message') as HTMLSpanElement;

const resultCard = document.getElementById('result-card') as HTMLElement;
const resultCategoryBadge = document.getElementById('result-category-badge') as HTMLSpanElement;
const resultScore = document.getElementById('result-score') as HTMLSpanElement;
const scoreMeterBar = document.getElementById('score-meter-bar') as HTMLDivElement;
const resultConfidence = document.getElementById('result-confidence') as HTMLParagraphElement;
const resultExplanation = document.getElementById('result-explanation') as HTMLParagraphElement;
const btnOpenWebsite = document.getElementById('btn-open-website') as HTMLAnchorElement;

let currentFile: File | null = null;
let currentMediaType: 'image' | 'video' = 'image';
let currentSettings: ExtensionSettings = {
  apiBaseUrl: 'http://localhost:8000',
  websiteUrl: 'http://localhost:3000',
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await checkBackendStatus();
  await loadCachedResult();

  setupEventListeners();
});

async function loadSettings() {
  return new Promise<void>((resolve) => {
    chrome.storage.local.get(['settings'], (res) => {
      if (res.settings) {
        currentSettings = res.settings;
      }
      inputApiUrl.value = currentSettings.apiBaseUrl;
      btnOpenWebsite.href = currentSettings.websiteUrl;
      resolve();
    });
  });
}

async function checkBackendStatus() {
  try {
    const res = await fetch(`${currentSettings.apiBaseUrl}/api/health`, { method: 'GET' });
    if (res.ok) {
      backendStatus.classList.add('connected');
      backendStatus.title = 'Backend API connected and ready';
    } else {
      backendStatus.classList.remove('connected');
      backendStatus.title = `Backend returned HTTP ${res.status}`;
    }
  } catch (e) {
    backendStatus.classList.remove('connected');
    backendStatus.title = 'Cannot connect to MediaCheck API backend';
  }
}

async function loadCachedResult() {
  chrome.storage.local.get(['latest_scan_result'], (res) => {
    if (res.latest_scan_result) {
      displayResult(res.latest_scan_result);
    }
  });
}

function setupEventListeners() {
  btnSettingsToggle.addEventListener('click', () => {
    settingsPane.classList.toggle('hidden');
  });

  btnSaveSettings.addEventListener('click', () => {
    const newUrl = inputApiUrl.value.trim().replace(/\/+$/, '');
    if (newUrl) {
      currentSettings.apiBaseUrl = newUrl;
      chrome.storage.local.set({ settings: currentSettings }, () => {
        settingsPane.classList.add('hidden');
        checkBackendStatus();
      });
    }
  });

  btnPickImage.addEventListener('click', () => fileInputImage.click());
  btnPickVideo.addEventListener('click', () => fileInputVideo.click());

  fileInputImage.addEventListener('change', (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files[0]) selectFile(files[0], 'image');
  });

  fileInputVideo.addEventListener('change', (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files[0]) selectFile(files[0], 'video');
  });

  btnCapsuleClear.addEventListener('click', clearSelectedFile);

  btnCheckAi.addEventListener('click', scanCurrentFile);
}

function selectFile(file: File, type: 'image' | 'video') {
  currentFile = file;
  currentMediaType = type;
  capsuleName.textContent = `${file.name} (${formatSize(file.size)})`;
  selectedCapsule.classList.remove('hidden');
  btnCheckAi.removeAttribute('disabled');
  errorBanner.classList.add('hidden');
}

function clearSelectedFile() {
  currentFile = null;
  fileInputImage.value = '';
  fileInputVideo.value = '';
  selectedCapsule.classList.add('hidden');
  btnCheckAi.setAttribute('disabled', 'true');
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function scanCurrentFile() {
  if (!currentFile) return;

  errorBanner.classList.add('hidden');
  resultCard.classList.add('hidden');
  loadingState.classList.remove('hidden');
  btnCheckAi.setAttribute('disabled', 'true');

  try {
    const formData = new FormData();
    formData.append('file', currentFile, currentFile.name);

    const endpoint = `${currentSettings.apiBaseUrl}/api/analyze/${currentMediaType}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.detail?.message || `Server returned ${res.status}`);
    }

    const result = data as DetectionResult;
    displayResult(result);

    // Save to storage
    chrome.storage.local.set({ latest_scan_result: result });
  } catch (err: any) {
    errorMessage.textContent = err.message || 'Detection failed. Verify backend service is running.';
    errorBanner.classList.remove('hidden');
  } finally {
    loadingState.classList.add('hidden');
    btnCheckAi.removeAttribute('disabled');
  }
}

function displayResult(result: DetectionResult) {
  resultCategoryBadge.className = 'category-badge';
  if (result.category === 'AI-generated signals detected') {
    resultCategoryBadge.classList.add('ai');
    scoreMeterBar.style.backgroundColor = 'var(--danger)';
  } else if (result.category === 'No AI-generated signals detected') {
    resultCategoryBadge.classList.add('safe');
    scoreMeterBar.style.backgroundColor = 'var(--success)';
  } else {
    scoreMeterBar.style.backgroundColor = 'var(--primary)';
  }

  resultCategoryBadge.textContent = result.category;

  const pct = result.score_percentage !== null ? result.score_percentage : 0;
  resultScore.textContent = `${pct}%`;
  scoreMeterBar.style.width = `${pct}%`;

  resultConfidence.textContent = result.confidence_label || '';
  resultExplanation.textContent = result.explanation || '';

  resultCard.classList.remove('hidden');
}
