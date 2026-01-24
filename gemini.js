// Gemini Question Navigator
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
    toggleButton.id = 'gemini-nav-toggle';
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
      background: #1a73e8;
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
    sidebar.id = 'gemini-nav-sidebar';
    sidebar.style.cssText = `
      position: fixed;
      top: 0;
      right: -320px;
      width: 300px;
      height: 100vh;
      background: #1e1e1e;
      border-left: 1px solid #333;
      z-index: 9999;
      transition: right 0.3s ease;
      display: flex;
      flex-direction: column;
      font-family: 'Google Sans', sans-serif;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px;
      border-bottom: 1px solid #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <span style="color: #e8eaed; font-size: 16px; font-weight: 500;">Questions</span>
      <button id="gemini-nav-refresh" style="
        background: none;
        border: none;
        color: #8ab4f8;
        cursor: pointer;
        font-size: 14px;
        padding: 4px 8px;
        border-radius: 4px;
      ">Refresh</button>
    `;
    sidebar.appendChild(header);

    // Questions list container
    const listContainer = document.createElement('div');
    listContainer.id = 'gemini-nav-list';
    listContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    `;
    sidebar.appendChild(listContainer);

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.id = 'gemini-nav-resize';
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
      resizeHandle.style.background = '#1a73e8';
    });
    resizeHandle.addEventListener('mouseleave', () => {
      if (!isResizing) resizeHandle.style.background = 'transparent';
    });
    resizeHandle.addEventListener('mousedown', startResize);
    sidebar.appendChild(resizeHandle);

    document.body.appendChild(sidebar);

    // Add refresh button listener
    document.getElementById('gemini-nav-refresh').addEventListener('click', updateQuestionsList);
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
    const resizeHandle = document.getElementById('gemini-nav-resize');
    if (resizeHandle) resizeHandle.style.background = 'transparent';
  }

  // Find all user questions in the chat
  function findUserQuestions() {
    const questions = [];

    // Gemini uses various selectors for user messages
    // Try multiple possible selectors
    const selectors = [
      'div[data-content-type="user"] .user-query-text',
      '.query-text',
      '.user-message',
      '[data-message-author="user"]',
      '.conversation-container .user-query',
      'message-content.user-message',
      '.query-content'
    ];

    // Try to find user messages by looking for the conversation structure
    // Gemini typically has turns with user and model messages
    const allMessages = document.querySelectorAll('[class*="query"], [class*="user"], [data-content-type="user"]');

    allMessages.forEach((el, index) => {
      // Check if this looks like a user message container
      const text = el.innerText?.trim();
      if (text && text.length > 0 && text.length < 500) {
        // Avoid duplicates and model responses
        const isLikelyUserMessage =
          el.closest('[data-content-type="user"]') ||
          el.classList.contains('query-text') ||
          el.classList.contains('user-query') ||
          (el.className && el.className.includes('user'));

        if (isLikelyUserMessage || el.matches('[class*="query-text"]')) {
          // Check if we already have this text
          if (!questions.some(q => q.text === text)) {
            questions.push({
              text: text,
              element: el,
              index: questions.length + 1
            });
          }
        }
      }
    });

    // Alternative: look for turn containers
    if (questions.length === 0) {
      const turns = document.querySelectorAll('.conversation-turn, [class*="turn"], [class*="message-pair"]');
      turns.forEach((turn, index) => {
        const userPart = turn.querySelector('[class*="user"], [class*="query"], [data-content-type="user"]');
        if (userPart) {
          const text = userPart.innerText?.trim();
          if (text && text.length > 0 && !questions.some(q => q.text === text)) {
            questions.push({
              text: text,
              element: userPart,
              index: questions.length + 1
            });
          }
        }
      });
    }

    return questions;
  }

  // Update the questions list in the sidebar
  function updateQuestionsList() {
    const listContainer = document.getElementById('gemini-nav-list');
    if (!listContainer) return;

    const questions = findUserQuestions();

    if (questions.length === 0) {
      listContainer.innerHTML = `
        <div style="color: #9aa0a6; text-align: center; padding: 20px; font-size: 14px;">
          No questions found yet.<br><br>
          <span style="font-size: 12px;">Start a conversation or click Refresh.</span>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = '';

    questions.forEach((q, index) => {
      const item = document.createElement('div');
      item.className = 'gemini-nav-item';
      item.style.cssText = `
        padding: 12px;
        margin-bottom: 8px;
        background: #2d2d2d;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
        border-left: 3px solid #1a73e8;
      `;

      // Truncate long questions
      const displayText = q.text.length > 100 ? q.text.substring(0, 100) + '...' : q.text;

      item.innerHTML = `
        <div style="color: #8ab4f8; font-size: 12px; margin-bottom: 4px;">Question ${q.index}</div>
        <div style="color: #e8eaed; font-size: 14px; line-height: 1.4;">${displayText}</div>
      `;

      item.addEventListener('mouseenter', () => {
        item.style.background = '#3d3d3d';
      });

      item.addEventListener('mouseleave', () => {
        item.style.background = '#2d2d2d';
      });

      item.addEventListener('click', () => {
        scrollToQuestion(q.element);
        toggleSidebar(); // Hide sidebar after clicking
      });

      listContainer.appendChild(item);
    });
  }

  // Scroll to a specific question
  function scrollToQuestion(element) {
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Briefly highlight the question
      const originalBg = element.style.backgroundColor;
      element.style.backgroundColor = 'rgba(26, 115, 232, 0.3)';
      element.style.transition = 'background-color 0.3s';

      setTimeout(() => {
        element.style.backgroundColor = originalBg;
      }, 1500);
    }
  }

  // Initialize
  function init() {
    // Wait for page to load
    setTimeout(() => {
      createToggleButton();
      createSidebar();
      console.log('[Gemini Navigator] Initialized');
    }, 1000);

    // Auto-refresh when new messages appear
    const observer = new MutationObserver(() => {
      if (sidebarVisible) {
        // Debounce updates
        clearTimeout(window.geminiNavUpdateTimeout);
        window.geminiNavUpdateTimeout = setTimeout(updateQuestionsList, 500);
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
