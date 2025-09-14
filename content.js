/**
 * content.js
 *
 * Runs in the context of every webpage and responds to messages from the
 * popup.  When asked for text it will return either the user’s current
 * selection or, if nothing is selected, all of the visible text on the
 * page.  The plain text is used as the input for the speech synthesis API.
 */

// Listen for messages from the popup or background scripts.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'getText') {
    try {
      let text = '';
      // Prefer whatever the user has selected.
      const selection = window.getSelection && window.getSelection().toString();
      if (selection && selection.trim()) {
        text = selection.trim();
      } else {
        // Fall back to the page’s body text.  innerText collapses hidden
        // elements and scripts so we get a fairly clean representation of
        // what the user sees on screen.
        text = document.body?.innerText || '';
      }
      sendResponse({ text });
    } catch (err) {
      console.error('Error extracting text for TTS:', err);
      sendResponse({ text: '' });
    }
    // Indicates to Chrome that sendResponse will be called synchronously.
    return true;
  }
});