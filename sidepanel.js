document.addEventListener('DOMContentLoaded', async function() {
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const clearBtn = document.getElementById('clearBtn');
    const actionSelect = document.getElementById('actionSelect');
    const selectionIndicator = document.getElementById('selectionIndicator');
    const selectionPreview = document.getElementById('selectionPreview');
    const welcome = document.getElementById('welcome');
    const autocompleteDropdown = document.getElementById('autocompleteDropdown');
    const imagePreview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    const removeImageBtn = document.getElementById('removeImageBtn');

    let currentAssistantMessage = null;
    let autocompleteIndex = -1;
    let currentImageData = null; // Base64 image data
    let streamText = '';
    let selectedText = '';
    let isGenerating = false;

    // Check if configured
    const { serverAddress, modelName } = await chrome.storage.sync.get(['serverAddress', 'modelName']);
    if (!serverAddress || !modelName) {
        showNotConfigured();
    }

    // Settings button
    settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Clear chat button
    clearBtn.addEventListener('click', () => {
        chatContainer.innerHTML = `
            <div class="welcome" id="welcome">
                <h2>Hey, I'm Sidekick</h2>
                <p>I automatically read page content and YouTube transcripts. Select text, use /commands, or just chat. Powered by your local AI.</p>
            </div>
        `;
        chrome.runtime.sendMessage({ action: 'clearHistory' });
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    });

    // Get selected text from active tab
    async function getSelectedText() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                return '';
            }
            const [{ result }] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => window.getSelection().toString(),
            });
            return result || '';
        } catch (e) {
            return '';
        }
    }

    // Get current tab info
    async function getCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            return tab;
        } catch (e) {
            return null;
        }
    }

    // Check if URL is a YouTube video
    function isYouTubeVideo(url) {
        return url && (url.includes('youtube.com/watch') || url.includes('youtu.be/'));
    }

    // Get YouTube video ID from URL
    function getYouTubeVideoId(url) {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
        return match ? match[1] : null;
    }

    // Get YouTube transcript
    async function getYouTubeTranscript(tabId) {
        try {
            const [{ result }] = await chrome.scripting.executeScript({
                target: { tabId },
                function: () => {
                    // Try to get transcript from YouTube's player
                    const segments = document.querySelectorAll('ytd-transcript-segment-renderer');
                    if (segments.length > 0) {
                        return Array.from(segments)
                            .map(s => s.textContent.trim())
                            .join(' ');
                    }

                    // Try alternative: look for transcript in the page data
                    const scripts = document.querySelectorAll('script');
                    for (const script of scripts) {
                        if (script.textContent.includes('captionTracks')) {
                            const match = script.textContent.match(/"captionTracks":\s*(\[.*?\])/);
                            if (match) {
                                try {
                                    const tracks = JSON.parse(match[1]);
                                    if (tracks[0]?.baseUrl) {
                                        return { captionUrl: tracks[0].baseUrl };
                                    }
                                } catch (e) {}
                            }
                        }
                    }
                    return null;
                }
            });

            // If we got a caption URL, fetch it
            if (result?.captionUrl) {
                try {
                    const response = await fetch(result.captionUrl);
                    const xml = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(xml, 'text/xml');
                    const texts = doc.querySelectorAll('text');
                    return Array.from(texts)
                        .map(t => t.textContent.replace(/&#39;/g, "'").replace(/&quot;/g, '"'))
                        .join(' ');
                } catch (e) {
                    return null;
                }
            }

            return result;
        } catch (e) {
            return null;
        }
    }

    // Get page content (text only, truncated)
    async function getPageContent(tabId) {
        try {
            const [{ result }] = await chrome.scripting.executeScript({
                target: { tabId },
                function: () => {
                    // Remove script, style, nav, footer, header elements
                    const clone = document.body.cloneNode(true);
                    const removeSelectors = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript', 'iframe'];
                    removeSelectors.forEach(sel => {
                        clone.querySelectorAll(sel).forEach(el => el.remove());
                    });

                    // Get text content and clean it up
                    let text = clone.innerText || clone.textContent || '';
                    // Collapse multiple whitespace/newlines
                    text = text.replace(/\s+/g, ' ').trim();
                    // Truncate to ~10000 chars to avoid token limits
                    if (text.length > 10000) {
                        text = text.substring(0, 10000) + '... [truncated]';
                    }
                    return text;
                }
            });
            return result || '';
        } catch (e) {
            return '';
        }
    }

    // Get context: selection > YouTube transcript > page content
    async function getContext() {
        const tab = await getCurrentTab();
        if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            return { type: 'none', content: '' };
        }

        // First check for selection
        const selection = await getSelectedText();
        if (selection && selection.trim()) {
            return { type: 'selection', content: selection.trim() };
        }

        // Check if YouTube video
        if (isYouTubeVideo(tab.url)) {
            const transcript = await getYouTubeTranscript(tab.id);
            if (transcript) {
                return { type: 'youtube', content: transcript, title: tab.title };
            }
        }

        // Fall back to page content
        const pageContent = await getPageContent(tab.id);
        if (pageContent) {
            return { type: 'page', content: pageContent, title: tab.title };
        }

        return { type: 'none', content: '' };
    }

    // Current context
    let currentContext = { type: 'none', content: '' };
    let contextDismissed = false;
    let lastTabUrl = '';

    // Check for context periodically
    async function checkContext() {
        const tab = await getCurrentTab();

        // Reset dismissed state if URL changed
        if (tab && tab.url !== lastTabUrl) {
            lastTabUrl = tab.url;
            contextDismissed = false;
        }

        // Check for new selection - if user selects text, un-dismiss
        const selection = await getSelectedText();
        if (selection && selection.trim()) {
            contextDismissed = false;
        }

        // If dismissed, don't show context
        if (contextDismissed) {
            selectedText = '';
            selectionIndicator.classList.remove('visible');
            return;
        }

        currentContext = await getContext();

        if (currentContext.type !== 'none' && currentContext.content) {
            let preview = '';
            let label = '';
            const contentLength = currentContext.content.length;
            const isLarge = contentLength > 4000;

            switch (currentContext.type) {
                case 'selection':
                    label = 'Selected';
                    preview = currentContext.content.length > 80
                        ? currentContext.content.substring(0, 80) + '...'
                        : currentContext.content;
                    break;
                case 'youtube':
                    label = 'YouTube transcript';
                    preview = currentContext.title || 'Video transcript loaded';
                    break;
                case 'page':
                    label = 'Page content';
                    preview = currentContext.title || 'Page content loaded';
                    break;
            }

            let warning = '';
            if (isLarge) {
                const chars = Math.round(contentLength / 1000);
                warning = `<span style="color: #f59e0b; font-size: 11px; display: block; margin-top: 4px;">Warning: ~${chars}k chars - may exceed context window on small models</span>`;
            }

            selectionIndicator.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div><strong>${label}:</strong> <span id="selectionPreview">${preview}</span></div>
                    <button class="dismiss-context-btn" style="background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 16px; padding: 0 0 0 8px; line-height: 1;">&times;</button>
                </div>
                ${warning}`;
            selectionIndicator.classList.add('visible');
            selectedText = currentContext.content;
        } else {
            selectedText = '';
            selectionIndicator.classList.remove('visible');
        }
    }

    // Dismiss context button handler (event delegation)
    selectionIndicator.addEventListener('click', (e) => {
        if (e.target.classList.contains('dismiss-context-btn')) {
            e.stopPropagation();
            selectedText = '';
            currentContext = { type: 'none', content: '' };
            contextDismissed = true;
            selectionIndicator.classList.remove('visible');
        }
    });

    // Check context on focus
    window.addEventListener('focus', checkContext);
    setInterval(checkContext, 3000);
    checkContext();

    // Listen for streaming messages
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'streamChunk') {
            if (currentAssistantMessage) {
                streamText += message.content;
                currentAssistantMessage.innerHTML = marked.parse(streamText);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        } else if (message.type === 'streamEnd') {
            isGenerating = false;
            updateSendButton();
        } else if (message.type === 'streamError') {
            isGenerating = false;
            updateSendButton();
            if (currentAssistantMessage) {
                currentAssistantMessage.textContent = `Error: ${message.error}`;
                currentAssistantMessage.style.color = '#ef4444';
            }
        }
    });

    function updateSendButton() {
        if (isGenerating) {
            sendBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
            sendBtn.title = 'Stop generation';
        } else {
            sendBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
            sendBtn.title = 'Send message';
        }
    }

    // Slash command definitions with descriptions
    const slashCommandDefs = [
        { cmd: '/summarize', action: 'summarize', desc: 'Summarize text' },
        { cmd: '/explain', action: 'explain', desc: 'Explain in simple terms' },
        { cmd: '/professional', action: 'professional', desc: 'Make text professional' },
        { cmd: '/actions', action: 'actionItems', desc: 'Extract action items' },
        { cmd: '/twitter', action: 'twitterThread', desc: 'Convert to tweet thread' },
        { cmd: '/chat', action: 'chat', desc: 'Regular conversation' }
    ];

    // Slash command mappings (for parsing)
    const slashCommands = {
        '/summarize': 'summarize',
        '/summary': 'summarize',
        '/professional': 'professional',
        '/pro': 'professional',
        '/actions': 'actionItems',
        '/action': 'actionItems',
        '/todos': 'actionItems',
        '/twitter': 'twitterThread',
        '/thread': 'twitterThread',
        '/tweet': 'twitterThread',
        '/explain': 'explain',
        '/eli5': 'explain',
        '/chat': 'chat'
    };

    // Parse slash command from input
    function parseSlashCommand(text) {
        const trimmed = text.trim();
        for (const [cmd, action] of Object.entries(slashCommands)) {
            if (trimmed.toLowerCase().startsWith(cmd + ' ') || trimmed.toLowerCase() === cmd) {
                const remainder = trimmed.slice(cmd.length).trim();
                return { action, text: remainder };
            }
        }
        return null;
    }

    // Autocomplete functions
    function showAutocomplete(filter = '') {
        const filtered = slashCommandDefs.filter(c =>
            c.cmd.toLowerCase().startsWith(filter.toLowerCase())
        );

        if (filtered.length === 0 || filter === '') {
            hideAutocomplete();
            return;
        }

        autocompleteDropdown.innerHTML = filtered.map((c, i) => `
            <div class="autocomplete-item${i === 0 ? ' selected' : ''}" data-cmd="${c.cmd}">
                <span class="autocomplete-cmd">${c.cmd}</span>
                <span class="autocomplete-desc">${c.desc}</span>
            </div>
        `).join('');

        autocompleteDropdown.classList.add('visible');
        autocompleteIndex = 0;

        // Add click handlers
        autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                selectAutocomplete(item.dataset.cmd);
            });
        });
    }

    function hideAutocomplete() {
        autocompleteDropdown.classList.remove('visible');
        autocompleteDropdown.innerHTML = '';
        autocompleteIndex = -1;
    }

    function selectAutocomplete(cmd) {
        messageInput.value = cmd + ' ';
        messageInput.focus();
        hideAutocomplete();
    }

    function navigateAutocomplete(direction) {
        const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
        if (items.length === 0) return;

        items[autocompleteIndex]?.classList.remove('selected');

        if (direction === 'down') {
            autocompleteIndex = (autocompleteIndex + 1) % items.length;
        } else {
            autocompleteIndex = (autocompleteIndex - 1 + items.length) % items.length;
        }

        items[autocompleteIndex]?.classList.add('selected');
        items[autocompleteIndex]?.scrollIntoView({ block: 'nearest' });
    }

    // Handle input for autocomplete
    messageInput.addEventListener('input', (e) => {
        const value = messageInput.value;

        // Check if typing a slash command
        if (value.startsWith('/') && !value.includes(' ')) {
            showAutocomplete(value);
        } else {
            hideAutocomplete();
        }
    });

    // Image handling functions
    function showImagePreview(dataUrl) {
        currentImageData = dataUrl;
        previewImg.src = dataUrl;
        imagePreview.classList.add('visible');
    }

    function clearImagePreview() {
        currentImageData = null;
        previewImg.src = '';
        imagePreview.classList.remove('visible');
    }

    // Handle paste for images
    messageInput.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        showImagePreview(event.target.result);
                    };
                    reader.readAsDataURL(file);
                }
                break;
            }
        }
    });

    // Remove image button
    removeImageBtn.addEventListener('click', clearImagePreview);

    // Send message
    async function sendMessage() {
        // If generating, stop instead
        if (isGenerating) {
            chrome.runtime.sendMessage({ action: 'stopGeneration' });
            return;
        }

        let userText = messageInput.value.trim();
        if (!userText && !selectedText && !currentImageData) return;

        const { serverAddress, modelName, systemPrompt, apiEndpoint } = await chrome.storage.sync.get(['serverAddress', 'modelName', 'systemPrompt', 'apiEndpoint']);
        if (!serverAddress || !modelName) {
            showNotConfigured();
            return;
        }

        // Hide welcome
        const welcomeEl = document.getElementById('welcome');
        if (welcomeEl) welcomeEl.style.display = 'none';

        // Check for slash command
        let action = actionSelect.value;
        const slashCmd = parseSlashCommand(userText);
        if (slashCmd) {
            action = slashCmd.action;
            userText = slashCmd.text;
            actionSelect.value = action; // Update dropdown to match
        }

        // Build prompt based on action
        let prompt = '';
        let contextLabel = '';
        switch (currentContext.type) {
            case 'selection': contextLabel = 'selected text'; break;
            case 'youtube': contextLabel = 'YouTube video transcript'; break;
            case 'page': contextLabel = 'page content'; break;
        }
        const context = selectedText ? `\n\nContext (${contextLabel}):\n${selectedText}` : '';

        switch(action) {
            case 'summarize':
                prompt = `Summarize the following:${context || '\n\n' + userText}`;
                if (userText && selectedText) prompt = `${userText}${context}`;
                break;
            case 'professional':
                prompt = `Make this more professional:${context || '\n\n' + userText}`;
                if (userText && selectedText) prompt = `${userText}${context}`;
                break;
            case 'actionItems':
                prompt = `Generate action items from:${context || '\n\n' + userText}`;
                if (userText && selectedText) prompt = `${userText}${context}`;
                break;
            case 'twitterThread':
                prompt = `Convert to a Twitter thread (280 chars per tweet):${context || '\n\n' + userText}`;
                if (userText && selectedText) prompt = `${userText}${context}`;
                break;
            case 'explain':
                prompt = `Explain this:${context || '\n\n' + userText}`;
                if (userText && selectedText) prompt = `${userText}${context}`;
                break;
            default: // chat
                prompt = userText + context;
                break;
        }

        // Add user message
        const userMessage = document.createElement('div');
        userMessage.className = 'message user';

        // Show image thumbnail in user message if present
        if (currentImageData) {
            const imgThumb = document.createElement('img');
            imgThumb.src = currentImageData;
            imgThumb.style.cssText = 'max-width: 100%; max-height: 100px; border-radius: 8px; margin-bottom: 8px; display: block;';
            userMessage.appendChild(imgThumb);
        }

        let displayText = userText;
        if (!displayText && selectedText) {
            const contextType = currentContext.type === 'youtube' ? 'video' : currentContext.type === 'page' ? 'page' : 'selection';
            displayText = `[${action}: ${contextType}]`;
        }
        if (!displayText && currentImageData) {
            displayText = '[Image]';
        }
        if (displayText) {
            const textSpan = document.createElement('span');
            textSpan.textContent = displayText;
            userMessage.appendChild(textSpan);
        }
        chatContainer.appendChild(userMessage);

        // Store image data before clearing
        const imageToSend = currentImageData;

        // Clear input and context
        messageInput.value = '';
        messageInput.style.height = 'auto';
        selectedText = '';
        currentContext = { type: 'none', content: '' };
        selectionIndicator.classList.remove('visible');
        clearImagePreview();

        // Add assistant message placeholder
        currentAssistantMessage = document.createElement('div');
        currentAssistantMessage.className = 'message assistant';
        currentAssistantMessage.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
        chatContainer.appendChild(currentAssistantMessage);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // Reset stream text and set generating state
        streamText = '';
        isGenerating = true;
        updateSendButton();

        // Send to background with history enabled for chat mode
        chrome.runtime.sendMessage({
            action: 'chatCompletion',
            serverAddress,
            modelName,
            prompt,
            systemPrompt,
            apiEndpoint,
            imageData: imageToSend,
            includeHistory: action === 'chat'
        });
    }

    // Send button click
    sendBtn.addEventListener('click', sendMessage);

    // Keyboard navigation
    messageInput.addEventListener('keydown', (e) => {
        const isAutocompleteVisible = autocompleteDropdown.classList.contains('visible');

        if (isAutocompleteVisible) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateAutocomplete('down');
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateAutocomplete('up');
                return;
            }
            if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
                e.preventDefault();
                const selected = autocompleteDropdown.querySelector('.autocomplete-item.selected');
                if (selected) {
                    selectAutocomplete(selected.dataset.cmd);
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                hideAutocomplete();
                return;
            }
        }

        // Enter to send (Shift+Enter for newline)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    function showNotConfigured() {
        chatContainer.innerHTML = `
            <div class="not-configured">
                <p>Please configure your LLM server first.</p>
                <button class="configure-btn" id="configureBtn">Open Settings</button>
            </div>
        `;
        document.getElementById('configureBtn').addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });
    }
});
