import { DetectionResult, ExtensionSettings } from './types';

const DEFAULT_SETTINGS: ExtensionSettings = {
  apiBaseUrl: 'http://localhost:8000',
  websiteUrl: 'http://localhost:3000',
};

// Initialize context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'mediacheck_scan_image',
    title: 'Check image with MediaCheck AI',
    contexts: ['image'],
  });

  // Ensure default settings
  chrome.storage.local.get(['settings'], (res) => {
    if (!res.settings) {
      chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    }
  });
});

// Context menu click listener
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'mediacheck_scan_image' && info.srcUrl) {
    await scanImageUrl(info.srcUrl);
  }
});

async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (res) => {
      resolve(res.settings || DEFAULT_SETTINGS);
    });
  });
}

export async function scanImageUrl(srcUrl: string): Promise<DetectionResult> {
  const settings = await getSettings();

  try {
    // Notify user scan is starting
    chrome.action.setBadgeText({ text: '...' });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });

    // Fetch image bytes
    const imgResponse = await fetch(srcUrl);
    if (!imgResponse.ok) {
      throw new Error(`Failed to fetch image from web page (${imgResponse.status}). The host might block hotlinking.`);
    }

    const blob = await imgResponse.blob();
    const filename = srcUrl.split('/').pop()?.split('?')[0] || 'web_image.jpg';

    // Submit to backend
    const formData = new FormData();
    formData.append('file', blob, filename);

    const apiResponse = await fetch(`${settings.apiBaseUrl}/api/analyze/image`, {
      method: 'POST',
      body: formData,
    });

    if (!apiResponse.ok) {
      const errData = await apiResponse.json().catch(() => ({}));
      const msg = errData.message || `API error (${apiResponse.status})`;
      throw new Error(msg);
    }

    const result: DetectionResult = await apiResponse.json();

    // Cache latest result in storage for popup
    await chrome.storage.local.set({
      latest_scan_result: result,
      latest_scan_source_url: srcUrl,
    });

    // Update badge and notification
    if (result.category === 'AI-generated signals detected') {
      chrome.action.setBadgeText({ text: 'AI' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    } else if (result.category === 'No AI-generated signals detected') {
      chrome.action.setBadgeText({ text: 'OK' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    } else {
      chrome.action.setBadgeText({ text: '?' });
      chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
    }

    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: `MediaCheck: ${result.category}`,
        message: `${result.confidence_label}. Click extension icon for the full breakdown.`,
      });
    }

    return result;
  } catch (error: any) {
    chrome.action.setBadgeText({ text: 'ERR' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });

    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'MediaCheck AI Scan Failed',
        message: error.message || 'Unable to scan image.',
      });
    }

    throw error;
  }
}

// Message handler for popup communications
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  } else if (message.action === 'SAVE_SETTINGS') {
    chrome.storage.local.set({ settings: message.settings }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
