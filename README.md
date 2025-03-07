# Ollama Copilot

Ollama Copilot integrates local LLMs from [Ollama](https://ollama.ai/) directly into VS Code, providing AI-powered code completion and an interactive chat experience with your own locally-running models.

## Features

- **AI-powered code completions**: Get contextual code suggestions as you type, with support for:
  - Variable and function name awareness
  - Context-aware completions based on surrounding code
  - Multi-line code suggestions
  - Language-specific completions
- **Dedicated chat interface**: Ask questions about your code and get detailed responses through:
  - Sidebar chat panel for quick access
  - Dedicated chat view for more detailed discussions
  - Real-time streaming responses
- **Local model selection**: Choose from any model installed in Ollama
- **Context-aware assistance**: The extension analyzes:
  - Selected code snippets
  - Specific files you choose
  - Your entire workspace
  - Function purposes and documentation
  - Variables in scope
- **Privacy-focused**: All processing happens locally on your machine through Ollama
- **Customizable configuration**: Set your preferred:
  - Default model
  - API host
  - Workspace context settings

## Prerequisites

1. [Ollama](https://ollama.ai/) must be installed and running on your system
2. You should have at least one model pulled in Ollama (see [model recommendations](#model-recommendations))

## Installation

1. Install the extension from the VS Code marketplace
2. Ensure Ollama is running in the background
3. Select a default model when prompted (or set it later in settings)

### Installing Models in Ollama

Before using the extension, you need to download at least one model in Ollama:

**Command Line:**
```bash
# Download a code-optimized model
ollama pull codellama:13b

# Download a general-purpose model
ollama pull llama3:8b

# List available models
ollama list
```

**Web UI:** You can also download models through the Ollama web interface at http://localhost:11434 if you have it enabled.

## Usage

### Code Completion

Code completion is automatically active while you type. The extension analyzes your code context, including:
- Variables in scope
- Function declarations and parameters
- Comments and documentation
- Surrounding code context

### Chat Interface

Two ways to access the chat:
1. **Sidebar Chat**: Quick access through the Ollama Chat icon in the activity bar
2. **Dedicated Chat Panel**: Full-featured chat interface with more options

Chat features include:
- Model selection dropdown
- Context file management
- Code snippet integration
- Workspace context toggle
- Real-time streaming responses

#### Adding Context

The chat interface provides several ways to add context:

- **Add Selected Code**: Select code in your editor, then click the "📄" button
- **Add File Context**: Click the "📎" button to choose specific files
- **Workspace Context**: Enable the "@workspace" checkbox to analyze your entire workspace

### Commands

Access these commands via Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

- **Open Ollama Chat Panel**: Opens the chat panel as a separate view
- **Select Default Model**: Change the default Ollama model
- **Search Available Models**: List all available models in Ollama
- **Clear Completion Cache**: Clear the cached completions

## Configuration

Configure the extension through VS Code settings:

- **Default Model**: Set your preferred model (`ollama.defaultModel`)
- **API Host**: Configure the Ollama API endpoint (`ollama.apiHost`)

## Model Recommendations

For the best experience, we recommend:

- **Code Completion**: Models fine-tuned for code generation
  - `codellama:13b` or `codellama:34b`
  - `wizardcoder:13b` or `wizardcoder:34b`
- **General Assistance**: Larger models with broad knowledge
  - `llama3:8b` or `llama3:70b`
  - `mistral:7b` or `mixtral:8x7b`
- **Specialized Tasks**: Task-specific models
  - `deepseek-coder:6.7b` or `deepseek-coder:33b` for code
  - `phind-codellama:34b` for programming Q&A

## Troubleshooting

### Common Issues

- **No Suggestions Appearing**: 
  - Ensure Ollama is running (`ollama serve`)
  - Check model is properly loaded
  - Clear completion cache and restart
- **Slow Performance**: 
  - Try using a smaller model
  - Reduce context size
  - Clear completion cache
- **Model Not Found**: 
  - Verify model is downloaded in Ollama
  - Check model name spelling
  - Run `ollama list` to see available models

### Connection Issues

If the extension can't connect to Ollama:

1. Verify Ollama is running (`ollama serve`)
2. Check the API host setting (`ollama.apiHost`)
3. Ensure port 11434 is accessible
4. Restart VS Code if necessary

## Privacy

All processing happens locally on your machine through your installed Ollama instance. No data is sent to external servers.

## Feedback and Contributions

We welcome feedback and contributions! Please submit issues and pull requests on our GitHub repository.

## License

[MIT License](LICENSE)
