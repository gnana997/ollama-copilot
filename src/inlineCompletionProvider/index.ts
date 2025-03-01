import * as vscode from "vscode";
import { OllamaInlineCompletionProvider } from "./OllamaInlineCompletionProvider";

// Create a single instance of the provider that can be accessed from outside
export let completionProvider: OllamaInlineCompletionProvider | null = null;

/**
 * Registers the inline completion provider with VS Code
 */
export function registerInlineCompletionProvider(
  context: vscode.ExtensionContext
) {
  // Create a single instance of the provider
  completionProvider = new OllamaInlineCompletionProvider();
  
  const provider = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: "**" },
    completionProvider
  );
  context.subscriptions.push(provider);
} 