/**
 * options.js
 *
 * Allows the user to configure their personal API key, resource ID,
 * preferred speaker and other audio parameters.  Settings are persisted
 * using chrome.storage.local so they can be read by the background
 * service worker when issuing requests to the Volcano Engine API.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Populate the form with previously saved values or defaults.
  chrome.storage.local.get(
    {
      apiKey: '',
      resourceId: '',
      speaker: '',
      additions: '',
      format: 'mp3',
      sampleRate: 24000,
      maxLength: 5000,
    },
    items => {
      document.getElementById('apiKey').value = items.apiKey;
      document.getElementById('resourceId').value = items.resourceId;
      document.getElementById('speaker').value = items.speaker;
      document.getElementById('additions').value = items.additions;
      document.getElementById('format').value = items.format;
      document.getElementById('sampleRate').value = items.sampleRate;
      document.getElementById('maxLength').value = items.maxLength;
    }
  );

  const form = document.getElementById('optionsForm');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const apiKey = document.getElementById('apiKey').value.trim();
    const resourceId = document.getElementById('resourceId').value.trim();
    const speaker = document.getElementById('speaker').value.trim();
    const additions = document.getElementById('additions').value.trim();
    const format = document.getElementById('format').value;
    const sampleRate = parseInt(document.getElementById('sampleRate').value, 10) || 24000;
    const maxLength = parseInt(document.getElementById('maxLength').value, 10) || 5000;
    const data = {
      apiKey,
      resourceId,
      speaker,
      additions,
      format,
      sampleRate,
      maxLength,
    };
    chrome.storage.local.set(data, () => {
      const msgEl = document.getElementById('message');
      msgEl.textContent = 'Settings saved successfully.';
      // Clear the message after a few seconds for a cleaner UI.
      setTimeout(() => {
        msgEl.textContent = '';
      }, 3000);
    });
  });
});