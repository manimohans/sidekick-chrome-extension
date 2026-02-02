# Chrome Web Store Listing

## Short Description (132 characters max)
Chat with your local LLM right from your browser. Works with Ollama, LM Studio, and any OpenAI-compatible server.

## Long Description (16000 characters max)

Sidekick brings the power of local AI directly into your browser. Chat with your own locally-running language models without sending any data to the cloud. Your conversations stay on your machine, giving you complete privacy and control.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 WHAT IS SIDEKICK?

Sidekick is a browser sidebar that connects to your local LLM server. Think of it as having ChatGPT-like capabilities, but running entirely on your own hardware. No API keys needed. No subscription fees. No data leaving your computer.

Whether you're summarizing articles, drafting professional emails, extracting action items from meeting notes, or just having a conversation - Sidekick makes it easy to leverage AI while browsing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ KEY FEATURES

【Sidebar Interface】
Sidekick opens as a convenient sidebar panel, so you can chat with AI while viewing any webpage. No popups or new tabs - everything stays in one place.

【Text Selection Integration】
Select any text on a webpage and Sidekick automatically detects it. Perfect for asking questions about content, getting summaries, or transforming text.

【Quick Actions】
Use the dropdown menu or slash commands to quickly:
• /summarize - Get concise summaries of long content
• /explain - Break down complex topics in simple terms
• /professional - Rewrite text in a professional tone
• /actions - Extract action items and to-dos
• /twitter - Convert content into a tweet thread

【Slash Command Autocomplete】
Type "/" to see all available commands with descriptions. Use arrow keys to navigate and Tab to complete - just like a modern code editor.

【Streaming Responses】
See responses as they're generated in real-time, just like ChatGPT. No waiting for the complete response before seeing any output.

【Conversation History】
Sidekick remembers your conversation context, allowing for natural back-and-forth dialogue. Clear the chat anytime to start fresh.

【Stop Generation】
Changed your mind? Click the stop button to halt response generation at any time.

【Markdown Support】
Responses are beautifully formatted with full markdown support - headings, bold, italics, code blocks, lists, and more.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒 PRIVACY FIRST

Unlike cloud-based AI services, Sidekick keeps everything local:

• Your prompts never leave your computer
• Your conversations are not stored on any server
• No account required
• No API keys to manage
• No usage limits or quotas
• No monthly fees

This makes Sidekick perfect for:
• Working with sensitive or confidential information
• Corporate environments with strict data policies
• Users who value privacy and data ownership
• Anyone who wants AI assistance without the cloud

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🖥️ SUPPORTED LLM SERVERS

Sidekick works with any server that supports the OpenAI-compatible API format (/v1/chat/completions endpoint):

【Ollama】
The most popular way to run LLMs locally. Free and open source.
• Default address: http://localhost:11434
• Install from: https://ollama.ai
• Run: ollama pull gemma3:1b

【LM Studio】
User-friendly desktop app for running local LLMs with a nice GUI.
• Default address: http://localhost:1234
• Enable "Local Server" in settings
• Download from: https://lmstudio.ai

【llama.cpp】
Lightweight, high-performance LLM inference.
• Run with the --api flag
• Great for advanced users

【vLLM】
High-throughput LLM serving.
• Default address: http://localhost:8000
• Excellent for multi-user setups

【Text Generation WebUI (Oobabooga)】
Feature-rich web interface for LLMs.
• Enable the API extension

【AnythingLLM】
All-in-one AI application.
• Check server settings for API address

【Any OpenAI-Compatible Server】
If it supports /v1/chat/completions, it works with Sidekick!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 QUICK START GUIDE

1. Install a Local LLM Server
   The easiest option is Ollama:
   • Download from https://ollama.ai
   • Install and run it
   • Open terminal and run: ollama pull gemma3:1b

2. Configure Sidekick
   • Click the Sidekick icon in your browser toolbar
   • Click the settings gear icon
   • Enter your server address (e.g., http://localhost:11434)
   • Enter your model name (e.g., gemma3:1b or google/gemma-3-1b)
   • Click "Test Connection" to verify

3. Start Chatting!
   • Click the Sidekick icon to open the sidebar
   • Type a message or select text on any page
   • Press Enter or click Send

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 USE CASES

【Research & Learning】
• Summarize long articles and papers
• Get explanations of complex topics
• Ask follow-up questions about content

【Writing & Communication】
• Draft professional emails
• Improve the tone of your writing
• Generate tweet threads from articles

【Productivity】
• Extract action items from meeting notes
• Create to-do lists from documents
• Quickly understand lengthy documents

【Development】
• Explain code snippets
• Get coding help while browsing documentation
• Debug errors by pasting stack traces

【Content Creation】
• Generate ideas and outlines
• Rewrite content for different audiences
• Transform content between formats

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⌨️ SLASH COMMANDS REFERENCE

Type these at the start of your message:

/summarize - Condense content into key points
/summary - Same as /summarize
/explain - Explain in simple, clear terms
/eli5 - Same as /explain (Explain Like I'm 5)
/professional - Rewrite in professional tone
/pro - Same as /professional
/actions - Extract action items and tasks
/todos - Same as /actions
/twitter - Convert to tweet thread format
/thread - Same as /twitter
/tweet - Same as /twitter
/chat - Regular conversation (default)

Pro tip: Type "/" to see the autocomplete menu!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 TROUBLESHOOTING

【Connection Issues】
• Make sure your LLM server is running
• Check that the server address is correct
• Try http://localhost:11434 for Ollama
• For remote servers, ensure the port is accessible

【"Server responded with 400"】
• Check that the model name is correct
• For LM Studio, use the full model ID (e.g., google/gemma-3-1b)
• Make sure there's no trailing slash in the server URL

【"Server responded with 404"】
• Your server might not support the OpenAI API format
• For Ollama, make sure you're using a recent version
• Check that the API endpoint is enabled

【Slow Responses】
• Try a smaller model (e.g., gemma3:1b instead of larger models)
• Use quantized models for faster inference
• Ensure your system has enough RAM for the model

【Remote Server Setup】
• Use the server's IP address (e.g., http://192.168.1.100:11434)
• For Ollama, set OLLAMA_HOST=0.0.0.0 on the server
• Make sure the firewall allows the port

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 RECOMMENDED MODELS

For the best experience, we recommend these models:

【Small & Fast】
• gemma3:1b - Great balance of speed and quality
• phi3 - Microsoft's compact but capable model
• tinyllama - Ultra-lightweight option

【Medium & Capable】
• gemma3:4b - Better quality, still fast
• llama3:8b - Meta's excellent general-purpose model
• mistral - Strong all-around performer

【Large & Powerful】
• gemma3:27b - Near-frontier quality
• llama3:70b - Top-tier performance (requires significant RAM)

Start with a smaller model to test, then upgrade based on your hardware capabilities.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 KEYBOARD SHORTCUTS

• Enter - Send message
• Shift + Enter - New line in message
• Tab - Complete slash command (when autocomplete is open)
• Arrow Up/Down - Navigate autocomplete options
• Escape - Close autocomplete menu

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❓ FREQUENTLY ASKED QUESTIONS

Q: Is my data sent to any external servers?
A: No! Sidekick only communicates with the local LLM server you configure. No data is sent to cloud services.

Q: Do I need an internet connection?
A: Only to install the extension. Once set up, Sidekick works entirely offline with your local server.

Q: What models can I use?
A: Any model supported by your LLM server. For Ollama, run "ollama list" to see installed models.

Q: Can I use this with ChatGPT or Claude API?
A: Sidekick is designed for local LLMs, but it technically works with any OpenAI-compatible API. However, using cloud APIs would send your data externally.

Q: Why is the extension asking for broad host permissions?
A: This allows Sidekick to connect to LLM servers on any address - whether localhost, a LAN IP, or a custom domain. Your browsing data is never accessed or transmitted.

Q: Can I use Sidekick on my phone?
A: Sidekick is a Chrome desktop extension. For mobile, check if your LLM server has its own mobile interface.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 FEEDBACK & SUPPORT

We'd love to hear from you! If you have suggestions, find bugs, or just want to say hi, please leave a review or reach out.

Enjoy your local AI assistant! 🎉
