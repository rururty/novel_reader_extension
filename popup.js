/**
 * popup.js
 *
 * Handles user interactions within the popup.  When the user clicks
 * “Start Reading” the script asks the content script for the current
 * selection or full page text, dispatches a synthesis request to the
 * background service worker and then plays back the resulting audio
 * segments one after another.  The background returns raw audio
 * buffers because service workers cannot create object URLs.  The
 * popup converts these buffers to object URLs before playback.  The
 * user can stop playback at any time.
 */

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const audioPlayer = document.getElementById('audioPlayer');

// Keep track of object URLs so we can revoke them when playback is
// finished or cancelled.  This helps avoid exhausting the in‑memory URL
// pool in long browsing sessions.
let currentUrls = [];
let currentIndex = 0;

// Plays the next audio segment in the queue.  When all segments have
// finished playback the controls are reset.
function playNext() {
  if (currentIndex >= currentUrls.length) {
    statusEl.textContent = 'Finished reading.';
    startBtn.disabled = false;
    stopBtn.disabled = true;
    return;
  }
  const url = currentUrls[currentIndex];
  audioPlayer.src = url;
  // Ensure the audio element loads the new source before playing.
  audioPlayer.load();
  audioPlayer.play().catch(err => {
    console.warn('Failed to play audio:', err);
  });
  statusEl.textContent = `Playing segment ${currentIndex + 1} of ${currentUrls.length}...`;
  audioPlayer.onended = () => {
    // Revoke the URL to free resources once this segment ends.
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      // ignore
    }
    currentIndex += 1;
    playNext();
  };
}

// Cancel playback and clean up any remaining object URLs.  This is called
// when the user clicks the Stop button or when synthesis errors occur.
function stopPlayback() {
  audioPlayer.pause();
  audioPlayer.src = '';
  // Revoke remaining URLs.
  for (let i = currentIndex; i < currentUrls.length; i++) {
    try {
      URL.revokeObjectURL(currentUrls[i]);
    } catch (e) {
      // ignore
    }
  }
  currentUrls = [];
  currentIndex = 0;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusEl.textContent = 'Playback stopped.';
}

stopBtn.addEventListener('click', () => {
  stopPlayback();
});

// Helpers used when synthesizing directly from the popup.  These mirror the
// functions defined in the background script but do not rely on a service
// worker.  By performing requests in the popup we avoid the 30 second
// lifetime limit of MV3 service workers and the associated "No response
// from background" error.
async function getSettingsFromStorage() {
  return new Promise(resolve => {
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
      items => resolve(items)
    );
  });
}

function splitTextPlain(text, maxLength) {
  const segments = [];
  let start = 0;
  while (start < text.length) {
    segments.push(text.slice(start, start + maxLength));
    start += maxLength;
  }
  return segments;
}

// Synthesize a single text segment using fetch.  Returns an ArrayBuffer
// containing raw audio data.  This function mirrors the logic in
// background.js but runs in the popup context.
async function synthesizeSegmentLocal(segment, settings) {
  const endpoint = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
  const headers = {
    'x-api-key': settings.apiKey,
    'X-Api-Resource-Id': settings.resourceId,
    'Content-Type': 'application/json',
  };
  const body = {
    req_params: {
      text: segment,
      speaker: settings.speaker,
      ...(settings.additions ? { additions: settings.additions } : {}),
      audio_params: {
        format: settings.format,
        sample_rate: Number(settings.sampleRate),
      },
    },
  };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} – ${response.statusText}`);
  }
  const contentType = response.headers.get('Content-Type') || '';
  const lowerType = contentType.toLowerCase();
  if (lowerType.includes('application/json') || lowerType.includes('text')) {
    const text = await response.text();
    const audioChunks = [];
    let totalLength = 0;
    const regex = /"data":"([^\"]*)"/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const b64 = match[1];
      if (b64 && b64 !== 'null') {
        try {
          const binaryStr = atob(b64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          audioChunks.push(bytes);
          totalLength += bytes.length;
        } catch (e) {
          // ignore invalid base64
        }
      }
    }
    if (!audioChunks.length) {
      throw new Error('No audio data returned from API.');
    }
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged.buffer;
  }
  const arrayBuffer = await response.arrayBuffer();
  return arrayBuffer;
}

// Perform synthesis for the full text by partitioning it into chunks and
// invoking synthesizeSegmentLocal for each chunk.  Returns an array of
// ArrayBuffers.
async function synthesizeAll(text) {
  const settings = await getSettingsFromStorage();
  if (!settings.apiKey || !settings.resourceId || !settings.speaker) {
    throw new Error('API key, resource ID and speaker must be configured in the options page.');
  }
  const maxLength = Number(settings.maxLength) || 5000;
  const segments = splitTextPlain(text, maxLength);
  const buffers = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    statusEl.textContent = `Synthesizing segment ${i + 1} of ${segments.length}...`;
    const buffer = await synthesizeSegmentLocal(segment, settings);
    buffers.push(buffer);
  }
  return { buffers, format: settings.format };
}

// Start button handler.  Extracts text from the page, synthesizes audio and
// initiates playback.  Performs synthesis directly in the popup.
startBtn.addEventListener('click', () => {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  statusEl.textContent = 'Extracting text from page...';
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs || !tabs.length) {
      statusEl.textContent = 'No active tab found.';
      startBtn.disabled = false;
      stopBtn.disabled = true;
      return;
    }
    const tabId = tabs[0].id;
    chrome.tabs.sendMessage(tabId, { type: 'getText' }, response => {
      if (chrome.runtime.lastError) {
        statusEl.textContent = 'Unable to retrieve text from this page.';
        startBtn.disabled = false;
        stopBtn.disabled = true;
        return;
      }
      const text = response?.text?.trim() || '';
      if (!text) {
        statusEl.textContent = 'No text found on this page.';
        startBtn.disabled = false;
        stopBtn.disabled = true;
        return;
      }
      (async () => {
        try {
          // Perform synthesis locally instead of messaging the background.
          const result = await synthesizeAll(text);
          const buffers = result.buffers || [];
          if (!buffers.length) {
            statusEl.textContent = 'No audio segments returned.';
            startBtn.disabled = false;
            stopBtn.disabled = true;
            return;
          }
          chrome.storage.local.get({ format: 'mp3' }, data => {
            const format = data.format || 'mp3';
            const mime = format.toLowerCase() === 'mp3' ? 'audio/mpeg' : `audio/${format}`;
            currentUrls = buffers.map(buffer => {
              const uint8 = new Uint8Array(buffer);
              const blob = new Blob([uint8], { type: mime });
              return URL.createObjectURL(blob);
            });
            currentIndex = 0;
            playNext();
          });
        } catch (err) {
          console.error('Synthesis error:', err);
          statusEl.textContent = `Error: ${err.message || err}`;
          startBtn.disabled = false;
          stopBtn.disabled = true;
        }
      })();
    });
  });
});