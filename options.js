document.addEventListener('DOMContentLoaded', function() {
    const saveBtn = document.getElementById('saveBtn');
    const testBtn = document.getElementById('testBtn');
    const serverAddressInput = document.getElementById('serverAddress');
    const modelNameInput = document.getElementById('modelName');
    const systemPromptInput = document.getElementById('systemPrompt');
    const apiEndpointSelect = document.getElementById('apiEndpoint');
    const charCount = document.getElementById('charCount');
    const statusDiv = document.getElementById('status');
    const testOutputDiv = document.getElementById('testOutput');
    const personaList = document.getElementById('personaList');
    const addPersonaBtn = document.getElementById('addPersonaBtn');
    const personaEditorContainer = document.getElementById('personaEditorContainer');

    let streamText = '';
    let personas = [];
    let editingPersonaId = null;

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

    // Hide status and testOutput divs initially
    statusDiv.style.display = 'none';
    testOutputDiv.style.display = 'none';

    // Load saved options
    chrome.storage.sync.get(['serverAddress', 'modelName', 'systemPrompt', 'apiEndpoint'], function(items) {
        serverAddressInput.value = items.serverAddress || '';
        modelNameInput.value = items.modelName || '';
        systemPromptInput.value = items.systemPrompt || '';
        apiEndpointSelect.value = items.apiEndpoint || 'chat';
        charCount.textContent = (items.systemPrompt || '').length;
    });

    // Character count for system prompt
    systemPromptInput.addEventListener('input', () => {
        charCount.textContent = systemPromptInput.value.length;
    });

    // Listen for streaming messages from background
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'streamChunk') {
            streamText += message.content;
            testOutputDiv.innerHTML = marked.parse(streamText);
        } else if (message.type === 'streamEnd') {
            testOutputDiv.innerHTML = '<h3>Connection successful!</h3>' + marked.parse(streamText);
        } else if (message.type === 'streamError') {
            testOutputDiv.textContent = `Error: ${message.error}`;
        }
    });

    // Save options
    saveBtn.addEventListener('click', function() {
        chrome.storage.sync.set({
            serverAddress: serverAddressInput.value,
            modelName: modelNameInput.value,
            systemPrompt: systemPromptInput.value,
            apiEndpoint: apiEndpointSelect.value
        }, function() {
            statusDiv.textContent = 'Options saved.';
            statusDiv.style.display = 'block';
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 2000);
        });
    });

    // Test connection via background script
    testBtn.addEventListener('click', async function() {
        testOutputDiv.style.display = 'block';
        testOutputDiv.textContent = 'Testing connection...';
        streamText = '';

        const serverAddress = serverAddressInput.value;
        const modelName = modelNameInput.value;

        chrome.runtime.sendMessage({
            action: 'chatCompletion',
            serverAddress,
            modelName,
            prompt: 'Hello! Please respond with a brief greeting.'
        });
    });

    // --- Persona CRUD ---

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    async function loadPersonas() {
        const result = await chrome.storage.local.get(['personas', 'personasSeeded']);
        if (!result.personasSeeded) {
            personas = DEFAULT_PERSONAS;
            await chrome.storage.local.set({ personas, personasSeeded: true });
        } else {
            personas = result.personas || [];
        }
        renderPersonaList();
    }

    async function savePersonas() {
        await chrome.storage.local.set({ personas });
    }

    function renderPersonaList() {
        personaList.innerHTML = '';
        personas.forEach(p => {
            const card = document.createElement('div');
            card.className = 'persona-card';
            card.innerHTML = `
                <div class="persona-card-info">
                    <div class="persona-card-name">${escapeHtml(p.name)}</div>
                    <div class="persona-card-patterns">${escapeHtml(p.urlPatterns.join(', '))}</div>
                </div>
                <div class="persona-card-actions">
                    <button class="secondary-btn persona-edit-btn" data-id="${p.id}">Edit</button>
                    <button class="danger-btn persona-delete-btn" data-id="${p.id}">Delete</button>
                </div>
            `;
            personaList.appendChild(card);
        });

        // Attach event listeners
        personaList.querySelectorAll('.persona-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openPersonaEditor(btn.dataset.id));
        });
        personaList.querySelectorAll('.persona-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deletePersona(btn.dataset.id));
        });
    }

    function openPersonaEditor(id = null) {
        editingPersonaId = id;
        const persona = id ? personas.find(p => p.id === id) : null;

        personaEditorContainer.innerHTML = `
            <div class="persona-editor">
                <label for="personaName">Name:</label>
                <input type="text" id="personaName" placeholder="e.g., Code Reviewer" value="${persona ? escapeHtml(persona.name) : ''}" maxlength="50">

                <label for="personaPrompt">System Prompt:</label>
                <textarea id="personaPrompt" placeholder="e.g., You are a senior code reviewer. Be concise and focus on bugs, security issues, and performance." rows="4" maxlength="2000">${persona ? escapeHtml(persona.systemPrompt) : ''}</textarea>
                <div class="char-count"><span id="personaCharCount">${persona ? persona.systemPrompt.length : 0}</span>/2000</div>

                <label for="personaPatterns">URL Patterns (one per line):</label>
                <textarea id="personaPatterns" placeholder="github.com&#10;*.stackoverflow.com&#10;docs.python.org" rows="3">${persona ? escapeHtml(persona.urlPatterns.join('\n')) : ''}</textarea>
                <div class="editor-hint">Use exact domains (github.com) or wildcards (*.google.com)</div>

                <div class="editor-actions">
                    <button id="personaSaveBtn">Save</button>
                    <button class="secondary-btn" id="personaCancelBtn">Cancel</button>
                    ${id ? '<button class="danger-btn" id="personaDeleteBtn">Delete</button>' : ''}
                </div>
            </div>
        `;

        const promptInput = document.getElementById('personaPrompt');
        const charCountSpan = document.getElementById('personaCharCount');
        promptInput.addEventListener('input', () => {
            charCountSpan.textContent = promptInput.value.length;
        });

        document.getElementById('personaSaveBtn').addEventListener('click', savePersona);
        document.getElementById('personaCancelBtn').addEventListener('click', closePersonaEditor);
        if (id) {
            document.getElementById('personaDeleteBtn').addEventListener('click', () => deletePersona(id));
        }

        addPersonaBtn.style.display = 'none';
    }

    function closePersonaEditor() {
        personaEditorContainer.innerHTML = '';
        editingPersonaId = null;
        addPersonaBtn.style.display = '';
    }

    async function savePersona() {
        const name = document.getElementById('personaName').value.trim();
        const systemPrompt = document.getElementById('personaPrompt').value.trim();
        const patternsRaw = document.getElementById('personaPatterns').value.trim();

        if (!name) return alert('Please enter a persona name.');
        if (!systemPrompt) return alert('Please enter a system prompt.');
        if (!patternsRaw) return alert('Please enter at least one URL pattern.');

        const urlPatterns = patternsRaw.split('\n').map(s => s.trim()).filter(Boolean);

        if (editingPersonaId) {
            const idx = personas.findIndex(p => p.id === editingPersonaId);
            if (idx !== -1) {
                personas[idx] = { ...personas[idx], name, systemPrompt, urlPatterns };
            }
        } else {
            personas.push({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                name,
                systemPrompt,
                urlPatterns
            });
        }

        await savePersonas();
        renderPersonaList();
        closePersonaEditor();
    }

    async function deletePersona(id) {
        if (!confirm('Delete this persona?')) return;
        personas = personas.filter(p => p.id !== id);
        await savePersonas();
        renderPersonaList();
        closePersonaEditor();
    }

    addPersonaBtn.addEventListener('click', () => openPersonaEditor());

    loadPersonas();
});
