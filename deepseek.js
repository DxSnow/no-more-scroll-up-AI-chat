// DeepSeek Question Navigator
// Shows a sidebar with all questions you've asked, click to jump to that Q&A

(function() {
  'use strict';

  // Sidebar state
  let sidebarVisible = false;
  let sidebar = null;
  let toggleButton = null;
  let sidebarWidth = 300;
  let isResizing = false;

  // Create the toggle button (floating button to show/hide sidebar)
  function createToggleButton() {
    if (toggleButton) return;

    toggleButton = document.createElement('button');
    toggleButton.id = 'deepseek-nav-toggle';
    toggleButton.innerHTML = '📋';
    toggleButton.title = 'Toggle Question Navigator';
    toggleButton.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 10000;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: #4d6bfe;
      color: white;
      font-size: 18px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transition: transform 0.2s, background 0.2s;
    `;

    toggleButton.addEventListener('mouseenter', () => {
      toggleButton.style.transform = 'scale(1.1)';
    });

    toggleButton.addEventListener('mouseleave', () => {
      toggleButton.style.transform = 'scale(1)';
    });

    toggleButton.addEventListener('click', toggleSidebar);
    document.body.appendChild(toggleButton);
  }

  // Create the sidebar
  function createSidebar() {
    if (sidebar) return;

    sidebar = document.createElement('div');
    sidebar.id = 'deepseek-nav-sidebar';
    sidebar.style.cssText = `
      position: fixed;
      top: 0;
      right: -320px;
      width: 300px;
      height: 100vh;
      background: #1a1a2e;
      border-left: 1px solid #3d3d5c;
      z-index: 9999;
      transition: right 0.3s ease;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px;
      border-bottom: 1px solid #3d3d5c;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <span style="color: #e8e8f0; font-size: 16px; font-weight: 500;">Questions</span>
      <button id="deepseek-nav-refresh" style="
        background: none;
        border: none;
        color: #4d6bfe;
        cursor: pointer;
        font-size: 14px;
        padding: 4px 8px;
        border-radius: 4px;
      ">Refresh</button>
    `;
    sidebar.appendChild(header);

    // Questions list container
    const listContainer = document.createElement('div');
    listContainer.id = 'deepseek-nav-list';
    listContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    `;
    sidebar.appendChild(listContainer);

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.id = 'deepseek-nav-resize';
    resizeHandle.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 6px;
      height: 100%;
      cursor: ew-resize;
      background: transparent;
      transition: background 0.2s;
    `;
    resizeHandle.addEventListener('mouseenter', () => {
      resizeHandle.style.background = '#4d6bfe';
    });
    resizeHandle.addEventListener('mouseleave', () => {
      if (!isResizing) resizeHandle.style.background = 'transparent';
    });
    resizeHandle.addEventListener('mousedown', startResize);
    sidebar.appendChild(resizeHandle);

    document.body.appendChild(sidebar);

    // Add refresh button listener
    document.getElementById('deepseek-nav-refresh').addEventListener('click', updateQuestionsList);
  }

  // Toggle sidebar visibility
  function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    if (sidebar) {
      sidebar.style.right = sidebarVisible ? '0' : `-${sidebarWidth + 20}px`;
    }
    if (sidebarVisible) {
      updateQuestionsList();
    }
  }

  // Resize functions
  function startResize(e) {
    isResizing = true;
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  function doResize(e) {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 200 && newWidth <= 600) {
      sidebarWidth = newWidth;
      sidebar.style.width = `${newWidth}px`;
    }
  }

  function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', doResize);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.userSelect = '';
    const resizeHandle = document.getElementById('deepseek-nav-resize');
    if (resizeHandle) resizeHandle.style.background = 'transparent';
  }

  // Find all user questions in the chat
  function findUserQuestions() {
    const questions = [];

    // DeepSeek uses various selectors for user messages
    // Try multiple approaches to find user messages

    // Approach 1: Look for elements with user-related attributes or classes
    const selectors = [
      '[data-role="user"]',
      '[class*="user-message"]',
      '[class*="userMessage"]',
      '.user-msg',
      '.human-message',
      '[data-message-type="user"]',
      '[data-author="user"]'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el, index) => {
        const text = el.innerText?.trim();
        if (text && text.length > 0 && text.length < 2000 && !questions.some(q => q.text === text)) {
          questions.push({
            text: text,
            element: el,
            index: questions.length + 1
          });
        }
      });
      if (questions.length > 0) break;
    }

    // Approach 2: Look for message containers and identify user messages
    if (questions.length === 0) {
      const messageContainers = document.querySelectorAll('[class*="message"], [class*="Message"], [class*="chat-item"], [class*="turn"]');
      messageContainers.forEach((container) => {
        // Check if it's a user message by looking for user indicators
        const isUser = container.classList.toString().toLowerCase().includes('user') ||
                       container.classList.toString().toLowerCase().includes('human') ||
                       container.querySelector('[class*="user"], [class*="human"], [class*="User"]') ||
                       container.getAttribute('data-role') === 'user';

        if (isUser) {
          const text = container.innerText?.trim();
          if (text && text.length > 0 && text.length < 2000 && !questions.some(q => q.text === text)) {
            questions.push({
              text: text,
              element: container,
              index: questions.length + 1
            });
          }
        }
      });
    }

    // Approach 3: Look for chat bubbles or conversation items
    if (questions.length === 0) {
      const allMessages = document.querySelectorAll('[class*="bubble"], [class*="Bubble"], [class*="content"]');
      let isUserTurn = true; // Assume alternating pattern starting with user

      allMessages.forEach((msg) => {
        const parent = msg.closest('[class*="message"], [class*="Message"], [class*="item"], [class*="turn"]');
        if (parent) {
          const parentClasses = parent.classList.toString().toLowerCase();
          const isAssistant = parentClasses.includes('assistant') ||
                              parentClasses.includes('bot') ||
                              parentClasses.includes('ai') ||
                              parentClasses.includes('deepseek');

          if (!isAssistant) {
            const text = msg.innerText?.trim();
            if (text && text.length > 0 && text.length < 2000 && !questions.some(q => q.text === text)) {
              questions.push({
                text: text,
                element: parent || msg,
                index: questions.length + 1
              });
            }
          }
        }
      });
    }

    // Approach 4: Generic fallback - look for alternating conversation pattern
    if (questions.length === 0) {
      const conversationItems = document.querySelectorAll('[class*="conversation"] > div, [class*="chat"] > div, main > div > div');
      const seenTexts = new Set();

      conversationItems.forEach((item, index) => {
        // Heuristic: User messages often come first or at even indices in conversation
        const text = item.innerText?.trim();
        const isLikelyResponse = text && text.length > 500; // Long texts are likely AI responses

        if (text && text.length > 0 && text.length < 500 && !seenTexts.has(text)) {
          seenTexts.add(text);
          questions.push({
            text: text,
            element: item,
            index: questions.length + 1
          });
        }
      });
    }

    return questions;
  }

  // Update the questions list in the sidebar
  function updateQuestionsList() {
    const listContainer = document.getElementById('deepseek-nav-list');
    if (!listContainer) return;

    const questions = findUserQuestions();

    if (questions.length === 0) {
      listContainer.innerHTML = `
        <div style="color: #8e8ea0; text-align: center; padding: 20px; font-size: 14px;">
          No questions found yet.<br><br>
          <span style="font-size: 12px;">Start a conversation or click Refresh.</span>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = '';

    questions.forEach((q, index) => {
      const item = document.createElement('div');
      item.className = 'deepseek-nav-item';
      item.style.cssText = `
        padding: 12px;
        margin-bottom: 8px;
        background: #2a2a4a;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
        border-left: 3px solid #4d6bfe;
      `;

      // Truncate long questions
      const displayText = q.text.length > 100 ? q.text.substring(0, 100) + '...' : q.text;

      item.innerHTML = `
        <div style="color: #4d6bfe; font-size: 12px; margin-bottom: 4px;">Question ${q.index}</div>
        <div style="color: #e8e8f0; font-size: 14px; line-height: 1.4;">${escapeHtml(displayText)}</div>
      `;

      item.addEventListener('mouseenter', () => {
        item.style.background = '#3a3a5a';
      });

      item.addEventListener('mouseleave', () => {
        item.style.background = '#2a2a4a';
      });

      item.addEventListener('click', () => {
        scrollToQuestion(q.element);
        toggleSidebar(); // Hide sidebar after clicking
      });

      listContainer.appendChild(item);
    });
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Scroll to a specific question
  function scrollToQuestion(element) {
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Briefly highlight the question
      const originalBg = element.style.backgroundColor;
      const originalTransition = element.style.transition;
      element.style.transition = 'background-color 0.3s';
      element.style.backgroundColor = 'rgba(77, 107, 254, 0.3)';

      setTimeout(() => {
        element.style.backgroundColor = originalBg;
        setTimeout(() => {
          element.style.transition = originalTransition;
        }, 300);
      }, 1500);
    }
  }

  // Initialize
  function init() {
    // Wait for page to load
    setTimeout(() => {
      createToggleButton();
      createSidebar();
      console.log('[DeepSeek Navigator] Initialized');
    }, 1000);

    // Auto-refresh when new messages appear
    const observer = new MutationObserver(() => {
      if (sidebarVisible) {
        // Debounce updates
        clearTimeout(window.deepseekNavUpdateTimeout);
        window.deepseekNavUpdateTimeout = setTimeout(updateQuestionsList, 500);
      }
    });

    // Start observing after a delay
    setTimeout(() => {
      const chatContainer = document.querySelector('main, [class*="conversation"], [class*="chat"]');
      if (chatContainer) {
        observer.observe(chatContainer, { childList: true, subtree: true });
      } else {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }, 2000);
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
