/**
 * AI Smart Assistant — Frontend Logic
 *
 * Manages conversations, sends messages to the Flask backend,
 * renders Markdown-lite AI responses, and handles UI state.
 */

(function () {
  "use strict";

  // ===== DOM references =====
  const sidebar          = document.getElementById("sidebar");
  const sidebarToggle    = document.getElementById("btn-sidebar-toggle");
  const sidebarOverlay   = document.getElementById("sidebar-overlay");
  const btnNewChat       = document.getElementById("btn-new-chat");
  const navHome          = document.getElementById("nav-home");
  const navHistory       = document.getElementById("nav-history");
  const conversationList = document.getElementById("conversation-list");
  const chatArea         = document.getElementById("chat-area");
  const welcomeScreen    = document.getElementById("welcome-screen");
  const messagesEl       = document.getElementById("messages");
  const typingIndicator  = document.getElementById("typing-indicator");
  const chatForm         = document.getElementById("chat-form");
  const messageInput     = document.getElementById("message-input");
  const btnSend          = document.getElementById("btn-send");
  const apiStatus        = document.getElementById("api-status");

  // ===== State =====
  let conversations = [];   // { id, title, messages: [{ role, content }] }
  let activeConvId  = null;
  let isSending     = false;

  // ===== Helpers =====
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatArea.scrollTop = chatArea.scrollHeight;
    });
  }

  // ===== Lightweight Markdown renderer =====
  function renderMarkdown(text) {
    let html = escapeHTML(text);

    // Code blocks: ```lang\n...\n```
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // Italic
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Headings (### ## #)
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm,  "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm,   "<h1>$1</h1>");

    // Blockquote
    html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

    // Unordered list items
    html = html.replace(/^[\-\*] (.+)$/gm, "<li>$1</li>");
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

    // Ordered list items
    html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

    // Line breaks → paragraphs (crude but effective)
    html = html
      .split(/\n{2,}/)
      .map((p) => {
        p = p.trim();
        if (!p) return "";
        if (/^<[hupol]|^<blockquote|^<pre/i.test(p)) return p;
        return `<p>${p.replace(/\n/g, "<br>")}</p>`;
      })
      .join("");

    return html;
  }

  function escapeHTML(str) {
    const el = document.createElement("div");
    el.textContent = str;
    return el.innerHTML;
  }

  // ===== Conversations =====
  function createConversation() {
    const conv = { id: uid(), title: "New Chat", messages: [] };
    conversations.unshift(conv);
    activeConvId = conv.id;
    renderSidebar();
    renderChat();
    messageInput.focus();
    return conv;
  }

  function getActiveConversation() {
    return conversations.find((c) => c.id === activeConvId) || null;
  }

  function switchConversation(id) {
    activeConvId = id;
    renderSidebar();
    renderChat();
    messageInput.focus();
  }

  function deriveTitle(text) {
    const clean = text.replace(/\n/g, " ").trim();
    return clean.length > 40 ? clean.slice(0, 40) + "…" : clean;
  }

  // ===== Render helpers =====
  function renderSidebar() {
    conversationList.innerHTML = "";
    conversations.forEach((c) => {
      const li = document.createElement("li");
      li.textContent = c.title;
      li.title = c.title;
      if (c.id === activeConvId) li.classList.add("active");
      li.addEventListener("click", () => switchConversation(c.id));
      conversationList.appendChild(li);
    });
  }

  function renderChat() {
    const conv = getActiveConversation();
    messagesEl.innerHTML = "";

    if (!conv || conv.messages.length === 0) {
      welcomeScreen.style.display = "flex";
      messagesEl.style.display = "none";
    } else {
      welcomeScreen.style.display = "none";
      messagesEl.style.display = "flex";
      conv.messages.forEach((m) => appendMessageBubble(m.role, m.content));
    }
    scrollToBottom();
  }

  function appendMessageBubble(role, content, opts = {}) {
    const row = document.createElement("div");
    row.classList.add("message-row", role);

    // Avatar
    const avatar = document.createElement("div");
    avatar.classList.add("message-avatar");
    if (role === "user") {
      avatar.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    } else {
      avatar.innerHTML = `<svg width="16" height="16" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="8" fill="url(#ab-g)"/><path d="M8 14.5l3.5 3.5L20 10" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><defs><linearGradient id="ab-g" x1="0" y1="0" x2="28" y2="28"><stop stop-color="#6C63FF"/><stop offset="1" stop-color="#4F46E5"/></linearGradient></defs></svg>`;
    }

    // Bubble
    const bubble = document.createElement("div");
    bubble.classList.add("message-bubble");
    if (role === "user") {
      bubble.textContent = content;
    } else {
      bubble.innerHTML = renderMarkdown(content);
    }

    row.appendChild(avatar);
    row.appendChild(bubble);

    // Error state
    if (opts.error) {
      const errDiv = document.createElement("div");
      errDiv.classList.add("message-error");
      errDiv.innerHTML = `<span>${escapeHTML(opts.error)}</span>`;
      const retryBtn = document.createElement("button");
      retryBtn.classList.add("btn-retry");
      retryBtn.textContent = "Retry";
      retryBtn.addEventListener("click", () => {
        row.remove();
        const conv = getActiveConversation();
        if (conv) {
          // Remove the failed assistant placeholder if exists
          if (conv.messages.length && conv.messages[conv.messages.length - 1].role === "assistant") {
            conv.messages.pop();
          }
          retrySend(conv);
        }
      });
      errDiv.appendChild(retryBtn);
      bubble.appendChild(errDiv);
    }

    messagesEl.appendChild(row);
    scrollToBottom();
    return row;
  }

  // ===== API calls =====
  async function checkHealth() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      const statusText = apiStatus.querySelector(".status-text");
      if (data.api_configured) {
        apiStatus.className = "api-status online";
        statusText.textContent = `Online · ${data.model}`;
      } else {
        apiStatus.className = "api-status offline";
        statusText.textContent = "API key not configured";
      }
    } catch {
      apiStatus.className = "api-status offline";
      apiStatus.querySelector(".status-text").textContent = "Backend offline";
    }
  }

  async function sendMessage(conv) {
    if (isSending) return;
    isSending = true;
    updateSendButton();
    showTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conv.messages }),
      });

      const data = await res.json();
      showTyping(false);

      if (!res.ok) {
        const errorMsg = data.error || `Request failed (${res.status})`;
        appendMessageBubble("assistant", "Sorry, something went wrong.", { error: errorMsg });
        return;
      }

      const reply = data.reply || "";
      conv.messages.push({ role: "assistant", content: reply });
      appendMessageBubble("assistant", reply);
    } catch (err) {
      showTyping(false);
      appendMessageBubble("assistant", "Sorry, something went wrong.", {
        error: "Network error — check that the server is running.",
      });
    } finally {
      isSending = false;
      updateSendButton();
    }
  }

  function retrySend(conv) {
    sendMessage(conv);
  }

  // ===== UI state =====
  function showTyping(visible) {
    typingIndicator.classList.toggle("hidden", !visible);
    scrollToBottom();
  }

  function updateSendButton() {
    const hasText = messageInput.value.trim().length > 0;
    btnSend.disabled = !hasText || isSending;
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("visible");
  }

  // ===== Auto-resize textarea =====
  function autoResize() {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + "px";
  }

  // ===== Event listeners =====
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text || isSending) return;

    let conv = getActiveConversation();
    if (!conv) conv = createConversation();

    // Update title from first user message
    if (conv.messages.length === 0) {
      conv.title = deriveTitle(text);
      renderSidebar();
    }

    conv.messages.push({ role: "user", content: text });

    // Hide welcome, show messages container
    welcomeScreen.style.display = "none";
    messagesEl.style.display = "flex";

    appendMessageBubble("user", text);

    messageInput.value = "";
    messageInput.style.height = "auto";
    updateSendButton();

    sendMessage(conv);
  });

  messageInput.addEventListener("input", () => {
    updateSendButton();
    autoResize();
  });

  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event("submit"));
    }
  });

  // Suggestion cards
  document.querySelectorAll(".suggestion-card").forEach((card) => {
    card.addEventListener("click", () => {
      const prompt = card.dataset.prompt;
      if (!prompt) return;
      messageInput.value = prompt;
      updateSendButton();
      chatForm.dispatchEvent(new Event("submit"));
    });
  });

  // New Chat
  btnNewChat.addEventListener("click", () => {
    createConversation();
    closeSidebar();
  });

  // Nav
  navHome.addEventListener("click", () => {
    navHome.classList.add("active");
    navHistory.classList.remove("active");
    if (!getActiveConversation() || getActiveConversation().messages.length === 0) return;
    createConversation();
    closeSidebar();
  });

  navHistory.addEventListener("click", () => {
    navHistory.classList.add("active");
    navHome.classList.remove("active");
    // Simply ensure the sidebar conversation list is visible (already is)
    closeSidebar();
  });

  // Sidebar toggle (mobile)
  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    sidebarOverlay.classList.toggle("visible");
  });
  sidebarOverlay.addEventListener("click", closeSidebar);

  // ===== Init =====
  createConversation();
  checkHealth();
  // Refresh health every 30 s
  setInterval(checkHealth, 30000);
})();
