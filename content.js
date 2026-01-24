// Get current page URL as storage key
function getPageKey() {
  try {
    const url = new URL(window.location.href);
    return url.origin + url.pathname;
  } catch (e) {
    return window.location.href;
  }
}

let pageUrl = getPageKey();

// Check if extension context is still valid
function isExtensionValid() {
  try {
    // Access chrome.runtime.id - if context is invalid, this throws
    const id = chrome.runtime?.id;
    return !!id;
  } catch (e) {
    return false;
  }
}

// Generate a unique ID for each highlight
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Load and apply saved highlights when page loads
async function loadHighlights() {
  if (!isExtensionValid()) return;

  try {
    pageUrl = getPageKey();
    const result = await chrome.storage.local.get(pageUrl);
    const highlights = result[pageUrl] || [];

    console.log('[Highlighter] Loading highlights for:', pageUrl, highlights);

    highlights.forEach(highlight => {
      restoreHighlight(highlight);
    });
  } catch (e) {
    console.log('[Highlighter] Error loading highlights:', e.message);
  }
}

// Restore a single highlight using surrounding context
function restoreHighlight(highlight) {
  const { text, id, beforeContext, afterContext } = highlight;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while (node = walker.nextNode()) {
    const nodeText = node.nodeValue;
    const index = nodeText.indexOf(text);

    if (index === -1) continue;

    // Skip if already highlighted
    if (node.parentElement?.classList?.contains('my-extension-highlight')) continue;

    // Check context to find the right occurrence
    const before = nodeText.substring(Math.max(0, index - 20), index);
    const after = nodeText.substring(index + text.length, index + text.length + 20);

    // If we have context, verify it matches
    if (beforeContext && afterContext) {
      if (!before.includes(beforeContext.slice(-10)) && !after.includes(afterContext.slice(0, 10))) {
        continue; // Context doesn't match, try next occurrence
      }
    }

    try {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + text.length);

      const span = document.createElement('span');
      span.style.backgroundColor = 'yellow';
      span.style.color = 'black';
      span.className = 'my-extension-highlight';
      span.dataset.highlightId = id;
      range.surroundContents(span);
      return true; // Only highlight the first matching occurrence
    } catch (e) {
      // Continue to next occurrence
    }
  }
  return false;
}

// Save highlight to storage with context
async function saveHighlight(text, id, beforeContext, afterContext) {
  if (!isExtensionValid()) return;

  try {
    pageUrl = getPageKey();
    const result = await chrome.storage.local.get(pageUrl);
    const highlights = result[pageUrl] || [];

    highlights.push({
      text: text,
      id: id,
      beforeContext: beforeContext,
      afterContext: afterContext
    });

    await chrome.storage.local.set({ [pageUrl]: highlights });
    console.log('[Highlighter] Saved highlight:', text, 'id:', id);
  } catch (e) {
    console.log('[Highlighter] Error saving highlight:', e.message);
  }
}

// Remove highlight from storage by ID
async function removeHighlight(id) {
  if (!isExtensionValid()) return;

  try {
    pageUrl = getPageKey();
    const result = await chrome.storage.local.get(pageUrl);
    let highlights = result[pageUrl] || [];

    highlights = highlights.filter(h => h.id !== id);
    await chrome.storage.local.set({ [pageUrl]: highlights });
    console.log('[Highlighter] Removed highlight id:', id);
  } catch (e) {
    console.log('[Highlighter] Error removing highlight:', e.message);
  }
}

// Find highlight element from a DOM node
function findHighlightFromNode(node) {
  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('my-extension-highlight')) {
      return node;
    }
    node = node.parentElement || node.parentNode;
  }
  return null;
}

// Get text context around the selection
function getSelectionContext(range) {
  const container = range.startContainer;
  if (container.nodeType !== Node.TEXT_NODE) {
    return { before: '', after: '' };
  }

  const text = container.nodeValue;
  const startOffset = range.startOffset;
  const endOffset = range.endOffset;

  const before = text.substring(Math.max(0, startOffset - 20), startOffset);
  const after = text.substring(endOffset, endOffset + 20);

  return { before, after };
}

// Listen for text selection (mouseup event)
// Hold Alt/Option key while selecting to highlight or unhighlight
document.addEventListener('mouseup', async (e) => {
  // Only highlight/unhighlight if Alt key is held down
  // Normal selection (without Alt) allows copying as usual
  if (!e.altKey) {
    return;
  }

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText.length > 0 && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const highlightEl = findHighlightFromNode(range.startContainer);

    if (highlightEl) {
      // Unhighlight: remove the highlight span and delete from storage
      const highlightId = highlightEl.dataset.highlightId;
      const highlightedText = highlightEl.textContent;
      const textNode = document.createTextNode(highlightedText);
      highlightEl.parentNode.replaceChild(textNode, highlightEl);
      await removeHighlight(highlightId);
      selection.removeAllRanges();
      return;
    }

    // Create new highlight
    const { before, after } = getSelectionContext(range);
    const highlightId = generateId();

    const span = document.createElement('span');
    span.style.backgroundColor = 'yellow';
    span.style.color = 'black';
    span.className = 'my-extension-highlight';
    span.dataset.highlightId = highlightId;

    try {
      range.surroundContents(span);
      await saveHighlight(selectedText, highlightId, before, after);
    } catch (e) {
      // surroundContents fails if selection spans multiple elements
      // Still save it but restoration may not work perfectly
      await saveHighlight(selectedText, highlightId, before, after);
    }

    selection.removeAllRanges();
  }
});

// Delayed load to wait for dynamic content
function delayedLoad() {
  setTimeout(loadHighlights, 500);
  setTimeout(loadHighlights, 1500);
  setTimeout(loadHighlights, 3000);
}

// Load highlights when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', delayedLoad);
} else {
  delayedLoad();
}

// Reload highlights when user returns to the page
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    delayedLoad();
  }
});

// Handle back/forward navigation
window.addEventListener('pageshow', () => {
  delayedLoad();
});

// Watch for dynamic content changes and re-apply highlights
let observerTimeout = null;
const observer = new MutationObserver(() => {
  if (observerTimeout) clearTimeout(observerTimeout);
  observerTimeout = setTimeout(loadHighlights, 500);
});

// Start observing after initial load
setTimeout(() => {
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}, 3000);
