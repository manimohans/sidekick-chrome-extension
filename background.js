// Open side panel when extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Store conversation history per tab
const conversationHistory = new Map();
let currentController = null;

// Handle API calls from sidepanel and options pages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'chatCompletion') {
        handleChatCompletion(request);
        return false; // Don't wait for response, we use message broadcasting
    }
    if (request.action === 'stopGeneration') {
        if (currentController) {
            currentController.abort();
            currentController = null;
            chrome.runtime.sendMessage({ type: 'streamEnd' }).catch(() => {});
        }
        return false;
    }
    if (request.action === 'clearHistory') {
        conversationHistory.clear();
        return false;
    }
    if (request.action === 'addToHistory') {
        const history = conversationHistory.get('default') || [];
        history.push({ role: request.role, content: request.content });
        // Keep last 20 messages to avoid token limits
        if (history.length > 20) history.shift();
        conversationHistory.set('default', history);
        return false;
    }
});

async function handleChatCompletion(request) {
    const { serverAddress: rawAddress, modelName, prompt, includeHistory, systemPrompt, apiEndpoint } = request;

    // Remove trailing slash from server address
    const serverAddress = rawAddress.replace(/\/+$/, '');

    // Create abort controller for this request
    currentController = new AbortController();

    try {
        let endpoint, body;

        if (apiEndpoint === 'responses') {
            // Responses API format
            endpoint = `${serverAddress}/v1/responses`;
            let input = prompt;
            if (systemPrompt && systemPrompt.trim()) {
                input = `${systemPrompt.trim()}\n\n${prompt}`;
            }
            body = JSON.stringify({
                model: modelName,
                input: input,
                stream: true
            });
        } else {
            // Chat completions format (default)
            endpoint = `${serverAddress}/v1/chat/completions`;
            let messages = [];

            // Add system prompt if provided
            if (systemPrompt && systemPrompt.trim()) {
                messages.push({ role: 'system', content: systemPrompt.trim() });
            }

            if (includeHistory) {
                const history = conversationHistory.get('default') || [];
                messages = [...messages, ...history];
            }

            messages.push({ role: 'user', content: prompt });
            body = JSON.stringify({
                model: modelName,
                messages: messages,
                stream: true
            });
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: body,
            signal: currentController.signal
        });

        if (!response.ok) {
            chrome.runtime.sendMessage({
                type: 'streamError',
                error: `Server responded with ${response.status}: ${response.statusText}`
            }).catch(() => {});
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                // Save assistant response to history
                if (includeHistory && fullResponse) {
                    const history = conversationHistory.get('default') || [];
                    history.push({ role: 'user', content: prompt });
                    history.push({ role: 'assistant', content: fullResponse });
                    if (history.length > 20) {
                        history.splice(0, 2); // Remove oldest pair
                    }
                    conversationHistory.set('default', history);
                }
                chrome.runtime.sendMessage({ type: 'streamEnd' }).catch(() => {});
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    try {
                        const jsonChunk = JSON.parse(data);
                        let content = '';

                        // Chat completions format
                        if (jsonChunk.choices?.[0]?.delta?.content) {
                            content = jsonChunk.choices[0].delta.content;
                        }
                        // Responses API format (response.output_text.delta)
                        else if (jsonChunk.type === 'response.output_text.delta' && jsonChunk.delta) {
                            content = jsonChunk.delta;
                        }

                        if (content) {
                            fullResponse += content;
                            chrome.runtime.sendMessage({ type: 'streamChunk', content }).catch(() => {});
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            chrome.runtime.sendMessage({ type: 'streamEnd' }).catch(() => {});
        } else {
            chrome.runtime.sendMessage({ type: 'streamError', error: error.message }).catch(() => {});
        }
    } finally {
        currentController = null;
    }
}
