# Ollama Copilot

Ollama Copilot integrates local LLMs from [Ollama](https://ollama.ai/) directly into VS Code, providing AI-powered code completion and an interactive chat experience with your own locally-running models.

## Features

- **AI-powered code completions**: Get contextual code suggestions as you type
- **Dedicated chat interface**: Ask questions about your code and get detailed responses
- **Local model selection**: Choose from any model installed in Ollama
- **Context-aware assistance**: The extension can analyze:
  - Selected code snippets
  - Specific files you choose
  - Your entire workspace
- **Privacy-focused**: All processing happens locally on your machine through Ollama

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

Code completion is automatically active while you type. The extension analyzes your code and suggests completions based on your context.

### Chat Interface

Access the chat interface through the Ollama Chat icon in the activity bar (sidebar):

1. Click on the Ollama Chat icon in the sidebar
2. Select a model from the dropdown menu
3. Type your question in the input box and click Send

#### Adding Context

The chat interface provides several ways to add context:

- **Add Selected Code**: Select code in your editor, then click the "📄" button to add it to your conversation
- **Add File Context**: Click the "📎" button to choose specific files for reference
- **Workspace Context**: Enable the "@workspace" checkbox to analyze your entire workspace

### Example Prompts

Here are some effective prompts to try with your code:

#### Code Improvement
- "How can I optimize this function for better performance?"
- "Refactor this code to be more readable"
- "Find potential bugs in this code"

#### Learning and Understanding
- "Explain what this code does in simple terms"
- "What design pattern is being used here?"
- "How does this algorithm work?"

#### Development Assistance
- "Generate unit tests for this function"
- "What's a better way to implement this feature?"
- "Help me debug this error: [paste error message]"

#### With Context
- "I'm working on a React component. How can I prevent unnecessary re-renders?"
- "This is my Express route handler. How should I add proper error handling?"
- "I'm using TypeScript with this Angular service. Help me fix these type errors."

### Commands

The extension provides the following commands (access via Command Palette - `Ctrl+Shift+P` or `Cmd+Shift+P`):

- **Open Ollama Chat Panel**: Opens the chat panel as a separate view
- **Select Default Model**: Change the default Ollama model
- **Search Available Models**: List all available models in Ollama
- **Clear Completion Cache**: Clear the cached completions

## Model Recommendations

> ⚠️ **Important**: The quality of suggestions and responses directly depends on the capability of your selected model. Larger, more capable models will generally provide better results.

For the best experience, we recommend:

- **Code Completion**: Models fine-tuned for code generation (CodeLlama, WizardCoder)
- **General Assistance**: Larger models with 7B+ parameters
- **Specialized Tasks**: Models trained for specific programming languages or frameworks

Models with more supported parameters will generate better and more accurate suggestions. Consider using:

- `codellama:13b` or `codellama:34b` for code completion
- `llama3:8b` or `llama3:70b` for general assistance
- `wizard-coder` models for advanced programming help

## Efficient Usage

- Be specific in your questions to get the most relevant answers
- Provide sufficient context when asking about complex code
- Use the workspace search option sparingly as it can be resource-intensive
- For code-specific questions, select the relevant code first before asking

## Configuration

You can configure the extension through VS Code settings:

- **Ollama Default Model**: Set your preferred model (`ollama.defaultModel`)

## Troubleshooting

### Common Issues

- **No Suggestions Appearing**: Ensure Ollama is running in the background
- **Slow Performance**: Try using a smaller model or provide less context
- **Model Not Found**: Make sure the model is downloaded in Ollama

### Connection Issues

If the extension can't connect to Ollama:

1. Verify Ollama is running (`ollama serve`)
2. Check that Ollama is accessible at http://localhost:11434
3. Restart VS Code if necessary

## Privacy

All processing happens locally on your machine through your installed Ollama instance. No data is sent to external servers.

## Feedback and Contributions

We welcome feedback and contributions! Please submit issues and pull requests on our GitHub repository.

## License

[MIT License](LICENSE)
