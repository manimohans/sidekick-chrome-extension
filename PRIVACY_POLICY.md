# Privacy Policy for Sidekick - Local AI Assistant

**Last Updated:** February 2025

## Overview

Sidekick is a browser extension that connects to locally-running AI language models. It is designed with privacy as a core principle — your data stays on your device.

## Data Collection

**Sidekick does NOT collect, store, or transmit any personal data.**

Specifically:
- ❌ No analytics or tracking
- ❌ No conversation logging
- ❌ No browsing history access
- ❌ No cookies or identifiers
- ❌ No data sent to external servers
- ❌ No account or registration required

## Data Storage

Sidekick stores only two user preferences locally on your device using Chrome's storage API:
- **Server Address** — The URL of your local LLM server (e.g., http://localhost:11434)
- **Model Name** — The name of the AI model to use (e.g., gemma3:1b)

This data:
- Never leaves your device
- Is not synced to any cloud service
- Can be cleared anytime via Chrome's extension settings

## Network Requests

Sidekick makes network requests **only** to the LLM server address you configure. These requests:
- Go directly from your browser to your local server
- Contain only your chat messages and the AI's responses
- Never pass through any third-party servers
- Never include browsing data, history, or personal information

## Permissions Explained

| Permission | Why It's Needed |
|------------|-----------------|
| activeTab | To detect text you've selected on a webpage |
| scripting | To read your text selection (runs only window.getSelection()) |
| storage | To save your server address and model name locally |
| sidePanel | To display the chat sidebar interface |
| declarativeNetRequest | To enable connections to local servers without CORS issues |
| Host permissions | To connect to LLM servers on any address you configure |

## Third-Party Services

Sidekick does not integrate with or send data to any third-party services. The only external communication is with the LLM server you explicitly configure.

## Children's Privacy

Sidekick does not knowingly collect any information from children under 13.

## Changes to This Policy

If this privacy policy changes, the updated version will be posted with a new "Last Updated" date.

## Contact

For questions about this privacy policy, please open an issue on the project's GitHub repository.

---

**Summary:** Sidekick is a local-first, privacy-respecting extension. Your conversations with AI stay between you and your own computer.
