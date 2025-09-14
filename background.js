/**
 * background.js
 *
 * Runs as a service worker and performs the heavy lifting of fetching
 * synthesized audio from the Volcano Engine TTS API.  It listens for
 * messages from the popup requesting speech synthesis, reads the
 * persisted API credentials from storage, divides long passages into
 * manageable chunks, calls the API for each chunk, and returns a list
 * of raw ArrayBuffers containing MP3 data.  The popup is responsible for
 * converting these buffers into object URLs and revoking them when finished.
 */

// Helper to fetch user‑supplied settings from chrome.storage.local.
async function getSettings() {
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

// Partition a string into chunks no longer than the specified length.  This
// naive implementation simply splits on character boundaries to avoid
// exceeding the API’s maximum allowed length.  A more sophisticated
// implementation could split on sentence boundaries, but this is good
// enough for most novel pages.
function splitText(text, maxLength) {
  const segments = [];
  let start = 0;
  while (start < text.length) {
    segments.push(text.slice(start, start + maxLength));
    start += maxLength;
  }
  return segments;
}

// Perform a single HTTP POST request to the unidirectional TTS endpoint and
// return the raw audio data as an ArrayBuffer.  Service workers do not
// support URL.createObjectURL(), so the popup will create object URLs
// from these buffers instead.  If the API responds with JSON rather
// than audio data we parse it and throw the error message.
async function synthesizeSegment(segment, settings) {
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
  // Inspect the Content‑Type header to decide how to interpret the body.  The
  // Volcano Engine API returns JSON lines with base64‑encoded audio in
  // `data` fields.  If we detect JSON, we concatenate all audio chunks.
  const contentType = response.headers.get('Content-Type') || '';
  const lowerType = contentType.toLowerCase();
  // If the response contains JSON data we need to parse individual lines
  // containing base64 encoded audio chunks.
  if (lowerType.includes('application/json') || lowerType.includes('text')) {
    const text = await response.text();
    // Each line is a JSON object.  Some lines carry base64 encoded audio
    // in the `data` property.  We decode these pieces and concatenate
    // them into a single ArrayBuffer.
    // Extract all base64 encoded audio chunks from "data":"..." occurrences
    const audioChunks = [];
    let totalLength = 0;
    const regex = /"data":"([^"]*)"/g;
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
        } catch (decodeErr) {
          // Ignore any chunks that fail to decode; these may not be audio
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
  // Otherwise assume the response contains raw binary audio data.
  const arrayBuffer = await response.arrayBuffer();
  return arrayBuffer;
}

// Handle incoming messages from the popup.
// Use a promise‑returning listener for message handling.  Manifest V3 service
// workers can return a promise directly to keep the event alive.  Chrome will
// resolve the returned promise and forward its value to the sender.  This
// pattern avoids `runtime.lastError: receiving end does not exist` when the
// service worker wakes up to handle a message.
// Listen for messages from the popup.  This handler uses an async
// function, allowing us to return a promise directly.  When the
// returned promise resolves, Chrome automatically forwards the value
// to the sender of the message.  See https://developer.chrome.com/docs/extensions/mv3/messaging/#sending-messages
chrome.runtime.onMessage.addListener(async (message, sender) => {
  if (!message || message.type !== 'synthesize') {
    return; // Ignore unrelated messages.
  }
  try {
    const settings = await getSettings();
    if (!settings.apiKey || !settings.resourceId || !settings.speaker) {
      throw new Error(
        'API key, resource ID and speaker must be configured in the options page.'
      );
    }
    const text = message.text || '';
    const maxLength = Number(settings.maxLength) || 5000;
    const segments = splitText(text, maxLength);
    const buffers = [];
    for (const segment of segments) {
      const buffer = await synthesizeSegment(segment, settings);
      buffers.push(buffer);
    }
    return { buffers, format: settings.format };
  } catch (err) {
    console.error('TTS synthesis failed:', err);
    return { error: err.message || String(err) };
  }
});