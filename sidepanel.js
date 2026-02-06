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

    const personaBadge = document.getElementById('personaBadge');
    const personaBadgeName = document.getElementById('personaBadgeName');
    const personaBadgeDismiss = document.getElementById('personaBadgeDismiss');

    let currentAssistantMessage = null;
    let autocompleteIndex = -1;
    let currentImageData = null; // Base64 image data
    let streamText = '';
    let selectedText = '';
    let isGenerating = false;
    let activePersona = null;
    let personaDismissedForDomain = null;

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

    // Persona matching
    function getDomain(url) {
        try { return new URL(url).hostname; } catch { return ''; }
    }

    function matchUrlPattern(pattern, url) {
        const domain = getDomain(url);
        if (!domain) return false;
        pattern = pattern.trim().toLowerCase();
        const lowerDomain = domain.toLowerCase();
        if (pattern.startsWith('*.')) {
            const suffix = pattern.slice(2);
            return lowerDomain === suffix || lowerDomain.endsWith('.' + suffix);
        }
        return lowerDomain === pattern;
    }

    const DEFAULT_PERSONAS = [
        {
            id: 'default-github',
            name: 'Code Reviewer',
            systemPrompt: 'You are a senior code reviewer. Focus on bugs, security issues, performance problems, and readability. Be concise and direct. When suggesting fixes, show the corrected code.',
            urlPatterns: ['github.com', '*.github.com', 'gitlab.com', '*.gitlab.com']
        },
        {
            id: 'default-stackoverflow',
            name: 'Tech Explainer',
            systemPrompt: 'You are a patient technical explainer. Give clear, practical answers with code examples when relevant. Mention common pitfalls. Prefer standard library solutions over third-party dependencies.',
            urlPatterns: ['stackoverflow.com', '*.stackexchange.com']
        },
        {
            id: 'default-youtube',
            name: 'Video Summarizer',
            systemPrompt: 'You are a video content analyst. Summarize key points clearly with timestamps when available. Extract actionable takeaways and highlight the most important claims or arguments made.',
            urlPatterns: ['youtube.com', 'www.youtube.com', 'youtu.be']
        },
        {
            id: 'default-reddit',
            name: 'Discussion Analyst',
            systemPrompt: 'You are a discussion analyst. Identify the main arguments, points of consensus, and areas of disagreement. Separate facts from opinions. Note the overall sentiment and any notable minority viewpoints.',
            urlPatterns: ['reddit.com', '*.reddit.com']
        },
        {
            id: 'default-wikipedia',
            name: 'Research Assistant',
            systemPrompt: 'You are a research assistant. Help synthesize information, identify key concepts, and explain complex topics in accessible language. Cross-reference claims when possible and note areas of uncertainty.',
            urlPatterns: ['*.wikipedia.org']
        },
        {
            id: 'default-twitter',
            name: 'Social Analyst',
            systemPrompt: 'You are a social media analyst. Help contextualize posts, threads, and discussions. Identify key claims, check for logical fallacies, and provide relevant background context.',
            urlPatterns: ['twitter.com', 'x.com']
        }
    ];

    async function seedDefaultPersonas() {
        const result = await chrome.storage.local.get('personasSeeded');
        if (!result.personasSeeded) {
            await chrome.storage.local.set({ personas: DEFAULT_PERSONAS, personasSeeded: true });
        }
    }
    seedDefaultPersonas();

    async function checkPersona() {
        const tab = await getCurrentTab();
        if (!tab?.url) {
            activePersona = null;
            personaBadge.classList.remove('visible');
            return;
        }

        const currentDomain = getDomain(tab.url);

        // If navigated to a different domain, reset dismissed state
        if (personaDismissedForDomain && currentDomain !== personaDismissedForDomain) {
            personaDismissedForDomain = null;
        }

        // If dismissed for this domain, hide badge
        if (personaDismissedForDomain === currentDomain) {
            activePersona = null;
            personaBadge.classList.remove('visible');
            return;
        }

        const result = await chrome.storage.local.get('personas');
        const personas = result.personas || [];

        const matched = personas.find(p =>
            p.urlPatterns.some(pat => matchUrlPattern(pat, tab.url))
        );

        if (matched) {
            activePersona = matched;
            personaBadgeName.textContent = matched.name;
            personaBadge.classList.add('visible');
        } else {
            activePersona = null;
            personaBadge.classList.remove('visible');
        }
    }

    personaBadgeDismiss.addEventListener('click', async () => {
        const tab = await getCurrentTab();
        if (tab?.url) {
            personaDismissedForDomain = getDomain(tab.url);
        }
        activePersona = null;
        personaBadge.classList.remove('visible');
    });

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
            checkPersona();
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
    checkPersona();

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
            if (currentAssistantMessage && !streamText) {
                currentAssistantMessage.textContent = 'Stopped.';
                currentAssistantMessage.style.color = 'var(--text-secondary)';
            }
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

        const { serverAddress, modelName, systemPrompt: defaultSystemPrompt, apiEndpoint } = await chrome.storage.sync.get(['serverAddress', 'modelName', 'systemPrompt', 'apiEndpoint']);
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

        // Build prompt: user query → persona → context
        let query = '';
        const actionPrompts = {
            summarize: 'Summarize the following:',
            professional: 'Make this more professional:',
            actionItems: 'Generate action items from:',
            twitterThread: 'Convert to a Twitter thread (280 chars per tweet):',
            explain: 'Explain this:'
        };

        if (action === 'chat') {
            query = userText;
        } else if (userText && selectedText) {
            query = userText;
        } else if (selectedText) {
            query = actionPrompts[action] || userText;
        } else {
            query = `${actionPrompts[action] || ''}\n\n${userText}`;
        }

        const personaNote = activePersona
            ? `\n\n[Style hint (${activePersona.name}): ${activePersona.systemPrompt} — Apply this style only if relevant to the user's request above.]`
            : '';

        let contextLabel = '';
        switch (currentContext.type) {
            case 'selection': contextLabel = 'selected text'; break;
            case 'youtube': contextLabel = 'YouTube video transcript'; break;
            case 'page': contextLabel = 'page content'; break;
        }
        const context = selectedText ? `\n\nContext (${contextLabel}):\n${selectedText}` : '';

        const prompt = query + personaNote + context;

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
        console.log('[Sidekick] sendMessage prompt:', { systemPrompt: defaultSystemPrompt, prompt });
        chrome.runtime.sendMessage({
            action: 'chatCompletion',
            serverAddress,
            modelName,
            prompt,
            systemPrompt: defaultSystemPrompt,
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

    // --- Multi-Tab Compare ---
    const compareBtn = document.getElementById('compareBtn');
    const tabPickerOverlay = document.getElementById('tabPickerOverlay');
    const tabPickerList = document.getElementById('tabPickerList');
    const tabCountBadge = document.getElementById('tabCountBadge');
    const tabPickerCancel = document.getElementById('tabPickerCancel');
    const tabPickerCompare = document.getElementById('tabPickerCompare');
    const compareInstructions = document.getElementById('compareInstructions');
    let selectedTabIds = new Set();

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    async function openTabPicker() {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        selectedTabIds.clear();
        tabPickerList.innerHTML = '';

        tabs.forEach(tab => {
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
            const row = document.createElement('div');
            row.className = 'tab-picker-row';
            row.dataset.tabId = tab.id;

            const favicon = tab.favIconUrl
                ? `<img class="tab-picker-favicon" src="${escapeHtml(tab.favIconUrl)}" onerror="this.style.display='none'">`
                : `<div class="tab-picker-favicon" style="background:var(--border);border-radius:2px;"></div>`;

            const displayUrl = tab.url.length > 60 ? tab.url.substring(0, 60) + '...' : tab.url;
            row.innerHTML = `
                <input type="checkbox" data-tab-id="${tab.id}">
                ${favicon}
                <div class="tab-picker-info">
                    <div class="tab-picker-title">${escapeHtml(tab.title || 'Untitled')}</div>
                    <div class="tab-picker-url">${escapeHtml(displayUrl)}</div>
                </div>
            `;
            row.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT') return;
                const cb = row.querySelector('input[type="checkbox"]');
                cb.checked = !cb.checked;
                cb.dispatchEvent(new Event('change'));
            });
            row.querySelector('input').addEventListener('change', (e) => {
                const id = Number(e.target.dataset.tabId);
                if (e.target.checked) {
                    if (selectedTabIds.size >= 6) {
                        e.target.checked = false;
                        return;
                    }
                    selectedTabIds.add(id);
                    row.classList.add('selected');
                } else {
                    selectedTabIds.delete(id);
                    row.classList.remove('selected');
                }
                updateTabPickerState();
            });
            tabPickerList.appendChild(row);
        });

        compareInstructions.value = '';
        updateTabPickerState();
        tabPickerOverlay.classList.add('visible');
    }

    function updateTabPickerState() {
        const count = selectedTabIds.size;
        tabCountBadge.textContent = count;
        tabPickerCompare.disabled = count < 1;
        tabPickerCompare.textContent = count >= 1 ? `Send (${count} tab${count > 1 ? 's' : ''})` : 'Send';
    }

    function closeTabPicker() {
        tabPickerOverlay.classList.remove('visible');
    }

    async function executeCompare() {
        const tabIds = Array.from(selectedTabIds);
        const instructions = compareInstructions.value.trim();
        closeTabPicker();

        // Hide welcome
        const welcomeEl = document.getElementById('welcome');
        if (welcomeEl) welcomeEl.style.display = 'none';

        // User message
        const userMessage = document.createElement('div');
        userMessage.className = 'message user';
        const tabLabel = `${tabIds.length} tab${tabIds.length > 1 ? 's' : ''}`;
        const label = instructions ? `[${tabLabel}] ${instructions}` : `[${tabLabel}] Analyze these pages`;
        userMessage.textContent = label;
        chatContainer.appendChild(userMessage);

        // Assistant placeholder
        currentAssistantMessage = document.createElement('div');
        currentAssistantMessage.className = 'message assistant';
        currentAssistantMessage.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
        chatContainer.appendChild(currentAssistantMessage);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // Extract content from each tab
        const pages = [];
        const errors = [];

        for (const tabId of tabIds) {
            try {
                const tab = await chrome.tabs.get(tabId);
                const [{ result }] = await chrome.scripting.executeScript({
                    target: { tabId },
                    function: () => {
                        const clone = document.body.cloneNode(true);
                        ['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript', 'iframe']
                            .forEach(sel => clone.querySelectorAll(sel).forEach(el => el.remove()));
                        let text = (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
                        if (text.length > 5000) text = text.substring(0, 5000) + '... [truncated]';
                        return text;
                    }
                });
                if (result) {
                    pages.push({ title: tab.title || 'Untitled', url: tab.url, content: result });
                } else {
                    errors.push(tab.title || 'Untitled');
                }
            } catch (e) {
                errors.push(`Tab ${tabId} (unavailable)`);
            }
        }

        if (pages.length < 1) {
            currentAssistantMessage.textContent = `Could not extract content from any tabs. ${errors.length ? 'Failed: ' + errors.join(', ') : ''}`;
            currentAssistantMessage.style.color = '#ef4444';
            return;
        }

        // Build prompt: user query → persona → page contents
        const defaultInstructions = pages.length > 1
            ? 'Analyze the following pages. Compare their content, highlight key similarities and differences, and provide notable insights.'
            : 'Analyze the following page and provide a detailed summary with key insights.';

        let prompt = (instructions || defaultInstructions);

        if (activePersona) {
            prompt += `\n\n[Style hint (${activePersona.name}): ${activePersona.systemPrompt} — Apply this style only if relevant to the user's request above.]`;
        }

        prompt += '\n\n';
        pages.forEach((p, i) => {
            prompt += `--- Page ${i + 1}: ${p.title} (${p.url}) ---\n${p.content}\n\n`;
        });

        if (errors.length) {
            prompt += `Note: Could not extract content from: ${errors.join(', ')}\n`;
        }

        // Get settings
        const { serverAddress, modelName, systemPrompt: defaultSystemPrompt, apiEndpoint } = await chrome.storage.sync.get(['serverAddress', 'modelName', 'systemPrompt', 'apiEndpoint']);
        if (!serverAddress || !modelName) {
            currentAssistantMessage.textContent = 'Please configure your LLM server first.';
            currentAssistantMessage.style.color = '#ef4444';
            return;
        }

        streamText = '';
        isGenerating = true;
        updateSendButton();

        console.log('[Sidekick] multiTab prompt:', { systemPrompt: defaultSystemPrompt, prompt });
        chrome.runtime.sendMessage({
            action: 'chatCompletion',
            serverAddress,
            modelName,
            prompt,
            systemPrompt: defaultSystemPrompt,
            apiEndpoint,
            includeHistory: false
        });
    }

    compareBtn.addEventListener('click', openTabPicker);
    tabPickerCancel.addEventListener('click', closeTabPicker);
    tabPickerCompare.addEventListener('click', executeCompare);
    tabPickerOverlay.addEventListener('click', (e) => {
        if (e.target === tabPickerOverlay) closeTabPicker();
    });
});
