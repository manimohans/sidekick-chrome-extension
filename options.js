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

    let streamText = '';

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
});
