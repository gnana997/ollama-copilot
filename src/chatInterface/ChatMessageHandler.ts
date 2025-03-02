import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import ollama from 'ollama';

/**
 * Handles chat messages and generates responses from Ollama
 */
export class ChatMessageHandler {
  private readonly _messageHistory: {
    role: 'user' | 'assistant' | 'system',
    content: string
  }[] = [];
  
  constructor() {
    // Add a system message to start the conversation
    this._messageHistory.push({
      role: 'system',
      content: 'You are a helpful assistant specializing in coding and software development. Analyze code, answer questions, and provide suggestions to help the user with their programming tasks.'
    });
  }
  
  /**
   * Processes a user message and returns a response
   */
  public async processMessage(
    message: string,
    model: string,
    contextFiles: string[] = [],
    useWorkspace: boolean = false
  ): Promise<string> {
    try {
      // Add file context if provided
      let contextContent = '';
      
      if (contextFiles.length > 0) {
        contextContent += 'Here are the files you requested for context:\n\n';
        for (const filePath of contextFiles) {
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const fileName = path.basename(filePath);
            contextContent += `--- ${fileName} ---\n${content}\n\n`;
          } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
          }
        }
      }
      
      // Add workspace context if requested
      if (useWorkspace && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        contextContent += await this._getWorkspaceContext();
      }
      
      // Create the enhanced message
      let enhancedMessage = message;
      if (contextContent) {
        enhancedMessage = `${contextContent}\n\nMy question or request about this code is: ${message}`;
      }
      
      // Add to message history
      this._messageHistory.push({
        role: 'user',
        content: enhancedMessage
      });
      
      // Get response from Ollama
      const response = await this._getOllamaResponse(model);
      
      // Add response to history
      this._messageHistory.push({
        role: 'assistant',
        content: response
      });
      
      return response;
    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }
  
  /**
   * Gets context information about the workspace
   */
  private async _getWorkspaceContext(): Promise<string> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return '';
    }
    
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    let contextInfo = `Workspace information from ${path.basename(workspaceRoot)}:\n\n`;
    
    try {
      // Get active editor content if available
      if (vscode.window.activeTextEditor) {
        const document = vscode.window.activeTextEditor.document;
        const fileName = path.basename(document.fileName);
        contextInfo += `Current file (${fileName}):\n${document.getText()}\n\n`;
      }
      
      // Get key project files if they exist
      const keyFiles = [
        'package.json',
        'tsconfig.json',
        'README.md'
      ];
      
      for (const file of keyFiles) {
        const filePath = path.join(workspaceRoot, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          contextInfo += `--- ${file} ---\n${content}\n\n`;
        }
      }
      
      // Get directory structure (limit depth for performance)
      contextInfo += 'Directory structure:\n';
      contextInfo += await this._getDirectoryStructure(workspaceRoot, 2);
      
      return contextInfo;
    } catch (error) {
      console.error('Error getting workspace context:', error);
      return 'Error reading workspace context.';
    }
  }
  
  /**
   * Gets a simple directory structure representation
   */
  private async _getDirectoryStructure(dir: string, maxDepth: number, currentDepth: number = 0): Promise<string> {
    if (currentDepth > maxDepth) {
      return '...\n';
    }
    
    try {
      let result = '';
      const indent = '  '.repeat(currentDepth);
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        // Skip node_modules, .git and other common large directories
        if (['node_modules', '.git', 'dist', 'build', 'out'].includes(item)) {
          result += `${indent}${item}/ (skipped)\n`;
          continue;
        }
        
        const itemPath = path.join(dir, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          result += `${indent}${item}/\n`;
          result += await this._getDirectoryStructure(itemPath, maxDepth, currentDepth + 1);
        } else {
          result += `${indent}${item}\n`;
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error getting directory structure:', error);
      return `${dir} (error reading directory)\n`;
    }
  }
  
  /**
   * Gets a response from Ollama
   */
  private async _getOllamaResponse(model: string): Promise<string> {
    try {
      // Limit the number of messages to prevent token limits
      const messageHistoryLimit = 10;
      const limitedHistory = this._messageHistory.slice(-messageHistoryLimit);
      
      const response = await ollama.chat({
        model: model,
        messages: limitedHistory,
        stream: false
      });
      
      return response.message.content;
    } catch (error) {
      console.error('Error getting Ollama response:', error);
      throw new Error(`Failed to get response from Ollama: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 