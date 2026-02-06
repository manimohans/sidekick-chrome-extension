<p align="center">
  <img src="assets/sidekick-logo-transparent.png" alt="Sidekick Logo" width="128" height="128">
</p>

<h1 align="center">Sidekick - Local AI Assistant</h1>

<p align="center">
  <strong>The only local AI sidebar with per-site personas and multi-tab queries</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#per-site-personas">Personas</a> •
  <a href="#multi-tab-queries">Multi-Tab</a> •
  <a href="#installation">Installation</a> •
  <a href="#setup">Setup</a> •
  <a href="#supported-servers">Supported Servers</a> •
  <a href="#privacy">Privacy</a>
</p>

---

Sidekick is a Chrome extension that connects to your locally-running AI models. It automatically adapts to the website you're on, lets you query across multiple tabs at once, and never sends a byte to the cloud.

## Features

- **Per-Site Personas** — Auto-activating AI personalities based on the website (see below)
- **Multi-Tab Queries** — Select multiple tabs and ask anything across all of them (see below)
- **Sidebar Interface** — Chat with AI without leaving your current tab
- **Auto Page Context** — Automatically reads page content and YouTube transcripts
- **Text Selection** — Select text on any page to use as context
- **Slash Commands** — Quick actions like `/summarize`, `/explain`, `/professional`
- **Streaming Responses** — Real-time token streaming with stop button
- **Conversation History** — Maintains context for natural back-and-forth dialogue
- **Image Support** — Paste images for vision models
- **Dark Mode** — Follows your system theme
- **Multiple API Formats** — Supports both Chat Completions and Responses API

## Per-Site Personas

Sidekick automatically switches personality based on the website you're on. A small badge appears in the sidebar header showing the active persona.

**6 built-in personas:**

| Site | Persona | Behavior |
|------|---------|----------|
| GitHub, GitLab | Code Reviewer | Focuses on bugs, security, performance |
| Stack Overflow | Tech Explainer | Practical answers with code examples |
| YouTube | Video Summarizer | Key points and actionable takeaways |
| Reddit | Discussion Analyst | Arguments, consensus, sentiment |
| Wikipedia | Research Assistant | Synthesis and accessible explanations |
| Twitter/X | Social Analyst | Context, claims, logical fallacies |

Personas are fully customizable — create your own in Settings for any URL pattern. Use exact domains (`github.com`) or wildcards (`*.google.com`).

Click the X on the badge to dismiss a persona for the current site.

## Multi-Tab Queries

Select multiple open tabs and ask anything across all of them in one prompt.

1. Click the **stack icon** in the sidebar header
2. Check the tabs you want (1–6 tabs)
3. Type your question (or leave blank for auto-analysis)
4. Click **Send**

Use cases: compare products, summarize research, find common themes, extract data across pages.

## Installation

### From Chrome Web Store
[Install Sidekick](https://chromewebstore.google.com/detail/sidekick-local-ai-assista/mddjmpjlfkbfgjlplhhffjinikjfdbhb)

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the extension folder

## Setup

1. **Install a local LLM server** (if you haven't already):
   - [Ollama](https://ollama.ai) — `ollama pull gemma3:1b`
   - [LM Studio](https://lmstudio.ai) — Download and enable Local Server

2. **Configure Sidekick:**
   - Click the Sidekick icon → Settings (gear icon)
   - Enter your server address (e.g., `http://localhost:11434`)
   - Enter your model name (e.g., `gemma3:1b` or `google/gemma-3-1b`)
   - Click "Test Connection" to verify

## Usage

1. Click the Sidekick icon to open the sidebar
2. Type a message or use a slash command
3. Sidekick automatically detects:
   - **Selected text** on the page
   - **YouTube transcripts** when on a video
   - **Page content** as fallback context

### Slash Commands

| Command | Description |
|---------|-------------|
| `/summarize` | Summarize content |
| `/explain` | Explain in simple terms |
| `/professional` | Rewrite professionally |
| `/actions` | Extract action items |
| `/twitter` | Convert to tweet thread |

Type `/` to see autocomplete suggestions.

## Supported Servers

Sidekick supports two API formats:
- `/v1/chat/completions` — OpenAI Chat Completions format
- `/v1/responses` — OpenAI Responses API format

**Compatible servers:**
| Server | Default Port |
|--------|--------------|
| [Ollama](https://ollama.ai) | 11434 |
| [LM Studio](https://lmstudio.ai) | 1234 |
| [llama.cpp](https://github.com/ggerganov/llama.cpp) | 8080 |
| [vLLM](https://github.com/vllm-project/vllm) | 8000 |
| [AnythingLLM](https://anythingllm.com) | varies |

## Privacy

- **100% Local** — All conversations stay between you and your local server
- **No Cloud** — No data is sent to external services
- **No Tracking** — No analytics, telemetry, or usage data collection
- **No Account** — No sign-up or API keys required

Your data never leaves your device.

## Development

```bash
# Clone the repository
git clone https://github.com/manimohans/sidekick-chrome-extension.git

# Load in Chrome
# 1. Go to chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked" and select the folder

# Bundle for distribution
./bundle.sh
```

## License

MIT License — feel free to use, modify, and distribute.

---

<p align="center">
  Made for local AI enthusiasts
</p>
