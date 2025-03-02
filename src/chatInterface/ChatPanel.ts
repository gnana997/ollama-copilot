import * as vscode from 'vscode';
import * as path from 'path';
import { ChatMessageHandler } from './ChatMessageHandler';
import { getAvailableOllamaModels, initializeOllamaClient } from '../utils/modelHelpers';
import { getNonce } from '../utils/nonce';

/**
 * Manages the chat panel webview
 */
export class ChatPanel {
  public static currentPanel: ChatPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _messageHandler: ChatMessageHandler;
  private _selectedModel: string = '';
  private _streamListeners: vscode.Disposable[] = [];
  
  /**
   * Private constructor for the Singleton pattern
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._messageHandler = new ChatMessageHandler();
    
    // Set the webview's initial html content
    this._update();
    
    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    
    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        await this._handleMessage(message);
      },
      null,
      this._disposables
    );
    
    // Initialize with the default model
    this._initializeDefaultModel();
  }
  
  /**
   * Creates or shows the chat panel
   */
  public static createOrShow(extensionUri: vscode.Uri): ChatPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;
      
    // If we already have a panel, show it
    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel._panel.reveal(column);
      return ChatPanel.currentPanel;
    }
    
    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'ollamaChatPanel',
      'Ollama Chat',
      column || vscode.ViewColumn.One,
      {
        // Enable JavaScript in the webview
        enableScripts: true,
        // And restrict the webview to only loading content from our extension's directory
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'out')
        ],
        retainContextWhenHidden: true
      }
    );
    
    ChatPanel.currentPanel = new ChatPanel(panel, extensionUri);
    return ChatPanel.currentPanel;
  }
  
  /**
   * Disposes the panel
   */
  public dispose() {
    ChatPanel.currentPanel = undefined;
    
    // Clean up our resources
    this._panel.dispose();
    
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
  
  /**
   * Initializes the default model
   */
  private async _initializeDefaultModel() {
    try {
      // Initialize the Ollama client first
      const connected = await initializeOllamaClient();
      if (!connected) {
        this._showErrorMessage('Could not connect to Ollama server. Please make sure it is running.');
        return;
      }
      
      const config = vscode.workspace.getConfiguration('ollama');
      const defaultModel = config.get<string>('defaultModel');
      
      const models = await getAvailableOllamaModels();
      console.log('Models loaded in Chat Panel:', models);
      
      if (models.length === 0) {
        this._showErrorMessage('No models found. Please make sure Ollama has at least one model installed.');
        return;
      }
      
      if (defaultModel && models.some(model => model.label === defaultModel)) {
        this._selectedModel = defaultModel;
      } else {
        this._selectedModel = models[0].label;
      }
      
      this._sendModelInfoToWebview();
    } catch (error) {
      console.error('Error initializing default model:', error);
      this._showErrorMessage(`Error initializing default model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Sends model info to the webview
   */
  private async _sendModelInfoToWebview() {
    try {
      const models = await getAvailableOllamaModels();
      
      console.log('Available models:', models);
      console.log('Selected model:', this._selectedModel);
      
      this._panel.webview.postMessage({
        type: 'updateModelInfo',
        models: models,
        selectedModel: this._selectedModel
      });
    } catch (error) {
      console.error('Error fetching or sending model info:', error);
      this._showErrorMessage(`Failed to load models: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Handles messages from the webview
   */
  private async _handleMessage(message: any) {
    switch (message.type) {
      case 'sendMessage':
        await this._handleChatMessage(message.text, message.contextFiles, message.useWorkspace);
        break;
        
      case 'selectModel':
        this._selectedModel = message.model;
        await this._sendModelInfoToWebview();
        break;
        
      case 'requestModels':
        console.log('Received explicit request for models from webview');
        await this._sendModelInfoToWebview();
        break;
        
      case 'addFileContext':
        await this._handleAddFileContext();
        break;
        
      case 'selectCodeForContext':
        await this._handleSelectCodeForContext();
        break;
        
      case 'stopGeneration':
        console.log('Received stop generation request');
        // First stop the generation in the message handler
        this._messageHandler.stopGeneration();
        
        // Dispose stream listeners to ensure they don't continue processing
        this._disposeStreamListeners();
        
        // Notify the webview that generation was cancelled
        this._panel.webview.postMessage({ type: 'generationCancelled' });
        
        // Also hide the loading indicator
        this._panel.webview.postMessage({ type: 'setLoading', loading: false });
        break;
        
      case 'newChat':
        console.log('Starting new chat');
        // Create a new ChatMessageHandler to reset the conversation history
        this._messageHandler = new ChatMessageHandler();
        break;
    }
  }
  
  /**
   * Handles a chat message
   */
  private async _handleChatMessage(text: string, contextFiles: string[], useWorkspace: boolean) {
    if (!this._selectedModel) {
      this._showErrorMessage('No model selected. Please select a model first.');
      return;
    }
    
    // Add the user message to the chat
    this._panel.webview.postMessage({
      type: 'addMessage',
      role: 'user',
      content: text
    });
    
    try {
      // Show loading indicator
      this._panel.webview.postMessage({ type: 'setLoading', loading: true });
      
      // Dispose any existing stream listeners
      this._disposeStreamListeners();
      
      // Set up streaming listeners
      this._streamListeners.push(
        this._messageHandler.onStream((content) => {
          console.log('Streaming content to webview, length:', content.length);
          this._panel.webview.postMessage({
            type: 'streamContent',
            content: content
          });
        })
      );
      
      this._streamListeners.push(
        this._messageHandler.onStreamComplete((fullContent) => {
          console.log('Stream complete, sending to webview');
          this._panel.webview.postMessage({
            type: 'streamComplete'
          });
          
          // Also send one final streamContent message to ensure the content is up to date
          this._panel.webview.postMessage({
            type: 'streamContent',
            content: fullContent
          });
        })
      );
      
      // Process the message with the message handler
      const response = await this._messageHandler.processMessage(
        text,
        this._selectedModel,
        contextFiles,
        useWorkspace
      );
      
      // Make sure the response is also sent to the thinking section
      this._panel.webview.postMessage({
        type: 'streamContent',
        content: response
      });
      
      // We don't need to add the message here since it's been streamed
      // and the streamComplete event will finalize it
    } catch (error) {
      console.error('Error processing message:', error);
      this._showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Hide loading indicator
      this._panel.webview.postMessage({ type: 'setLoading', loading: false });
      // Dispose stream listeners
      this._disposeStreamListeners();
    }
  }
  
  /**
   * Disposes of stream listeners
   */
  private _disposeStreamListeners() {
    while (this._streamListeners.length) {
      const listener = this._streamListeners.pop();
      if (listener) {
        listener.dispose();
      }
    }
  }
  
  /**
   * Handles adding file context
   */
  private async _handleAddFileContext() {
    const files = await vscode.window.showOpenDialog({
      canSelectMany: true,
      openLabel: 'Add to Context',
      filters: {
        'All Files': ['*']
      }
    });
    
    if (files && files.length > 0) {
      const contextFiles = files.map(file => file.fsPath);
      this._panel.webview.postMessage({
        type: 'updateContextFiles',
        files: contextFiles
      });
    }
  }
  
  /**
   * Handles selecting code for context
   */
  private async _handleSelectCodeForContext() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this._showErrorMessage('No active editor to select code from');
      return;
    }
    
    const selection = editor.selection;
    if (selection.isEmpty) {
      this._showErrorMessage('No code selected');
      return;
    }
    
    const selectedText = editor.document.getText(selection);
    const fileName = editor.document.fileName;
    
    this._panel.webview.postMessage({
      type: 'addCodeSelection',
      code: selectedText,
      fileName: path.basename(fileName)
    });
  }
  
  /**
   * Shows an error message
   */
  private _showErrorMessage(message: string) {
    vscode.window.showErrorMessage(`Ollama Chat: ${message}`);
    this._panel.webview.postMessage({
      type: 'showError',
      message: message
    });
  }
  
  /**
   * Updates the webview content
   */
  private _update() {
    const webview = this._panel.webview;
    this._panel.title = 'Ollama Chat';
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }
  
  /**
   * Returns the HTML for the webview
   */
  private _getHtmlForWebview(webview: vscode.Webview) {
    // Local path to script and css for the webview
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'chat.js')
    );
    
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'chat.css')
    );
    
    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>Ollama Chat</title>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="model-selector">
                <label for="model-select">Model:</label>
                <select id="model-select" name="model-select">
                    <!-- Models will be populated here -->
                    <option value="" disabled selected>Loading models...</option>
                </select>
            </div>
            <div class="context-controls">
                <button id="add-file-btn">Add File Context</button>
                <button id="select-code-btn">Use Selected Code</button>
                <button id="new-chat-btn">New Chat</button>
                <label for="use-workspace">
                    <input type="checkbox" id="use-workspace" />
                    @workspace
                </label>
            </div>
        </div>
        
        <div class="context-files">
            <h4>Context Files:</h4>
            <ul id="context-files-list"></ul>
        </div>
        
        <div class="chat-container">
            <div id="chat-messages"></div>
            
            <div class="input-container">
                <textarea id="message-input" placeholder="Ask a question about your code..."></textarea>
                <button id="send-button">Send</button>
            </div>
        </div>
    </div>
    
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
} 