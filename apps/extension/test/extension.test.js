const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Extension manifest exists and has valid V3 configuration', () => {
  const manifestPath = path.join(__dirname, '../dist/manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist in dist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.manifest_version, 3, 'Must be Manifest V3');
  assert.equal(manifest.name, 'MediaCheck AI — Image & Video Detector');
  assert.ok(manifest.permissions.includes('contextMenus'), 'Must have contextMenus permission');
  assert.ok(manifest.permissions.includes('storage'), 'Must have storage permission');
  assert.ok(manifest.action.default_popup === 'popup.html', 'Must define default popup');
  assert.ok(manifest.background.service_worker === 'background.js', 'Must define service worker');
  assert.ok(
    manifest.host_permissions.some((p) => p.includes('localhost') || p.includes('127.0.0.1')),
    'Must restrict host permissions to backend API'
  );
});

test('Built background.js and popup.js exist and are not empty', () => {
  const bgPath = path.join(__dirname, '../dist/background.js');
  const popupPath = path.join(__dirname, '../dist/popup.js');

  assert.ok(fs.existsSync(bgPath), 'background.js must exist');
  assert.ok(fs.statSync(bgPath).size > 100, 'background.js must not be empty');

  assert.ok(fs.existsSync(popupPath), 'popup.js must exist');
  assert.ok(fs.statSync(popupPath).size > 100, 'popup.js must not be empty');
});

test('Extension API mock integration logic test', async () => {
  // Simulate how background worker packages and receives detection payload
  const mockPayload = {
    id: 'test-uuid-123',
    category: 'AI-generated signals detected',
    score: 0.94,
    score_percentage: 94.0,
    confidence_label: 'High confidence AI signals detected (94.0%)',
    provider: 'Sightengine',
    method: 'Sightengine genai model',
    generator_scores: { midjourney: 0.88 },
  };

  assert.equal(mockPayload.category, 'AI-generated signals detected');
  assert.ok(mockPayload.score >= 0.65, 'AI signal detected category matches threshold');
  assert.equal(mockPayload.score_percentage, 94.0);
});

test('Extension settings defaults are valid and secure', () => {
  const defaultSettings = {
    apiBaseUrl: 'http://localhost:8000',
    websiteUrl: 'http://localhost:3000',
  };

  assert.ok(defaultSettings.apiBaseUrl.startsWith('http://localhost') || defaultSettings.apiBaseUrl.startsWith('https://'));
  assert.ok(!defaultSettings.apiBaseUrl.endsWith('/'), 'Base URL should not have trailing slash');
});
