// OllamaInlineCompletionProvider.ts
import * as vscode from "vscode";
import ollama from "ollama";
import { LRUCache } from "../utils/LRUCache";
import { generatePrompt } from "./promptGenerators";
import { cleanAIResponse, getUniqueCompletion } from "./responseCleaners";
import { getFileContext, getContextHash } from "./helpers";

export class OllamaInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  private currentResponse: { abort: () => void } | null = null;
  private debounceTimeout: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 200; // ms
  private readonly completionCache: LRUCache<string, { completion: string; timestamp: number }>;
  private readonly CACHE_SIZE = 100;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.completionCache = new LRUCache(this.CACHE_SIZE);
  }

  public clearCache(): void {
    this.completionCache.clear();
    vscode.window.showInformationMessage('Ollama Copilot: Completion cache cleared');
  }

  private generateCacheKey(document: vscode.TextDocument, position: vscode.Position): string {
    const linePrefix = document.lineAt(position.line).text.substring(0, position.character);
    const contextHash = getContextHash(document, position);
    return `${contextHash}:${linePrefix}:${position.line}:${position.character}`;
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const linePrefix = document.lineAt(position.line).text.substring(0, position.character);
  
    const cacheKey = this.generateCacheKey(document, position);
    const cachedResult = this.completionCache.get(cacheKey);
    if (cachedResult && Date.now() - cachedResult.timestamp < this.CACHE_TTL) {
      const uniqueCompletion = getUniqueCompletion(cachedResult.completion, linePrefix);
      if (uniqueCompletion) {
        console.log("Returning cached completion:", uniqueCompletion);
        return [new vscode.InlineCompletionItem(uniqueCompletion)];
      }
    }
  
    if (this.currentResponse && token.isCancellationRequested) {
      this.currentResponse.abort();
      this.currentResponse = null;
    }
  
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
  
    const abortHandler = () => {
      if (this.currentResponse) {
        this.currentResponse.abort();
        this.currentResponse = null;
        console.log("Aborted due to token cancellation");
      }
    };
    token.onCancellationRequested(abortHandler);
  
    return new Promise((resolve) => {
      this.debounceTimeout = setTimeout(async () => {
        try {
          const config = vscode.workspace.getConfiguration("ollama");
          const model = config.get<string>("defaultModel");
          if (!model) {
            vscode.window.showWarningMessage("No Ollama model selected.");
            resolve(undefined);
            return;
          }
  
          const fileContext = getFileContext(document, position);
          console.log("File context:", fileContext);
          const prompt = generatePrompt(fileContext, document, position);
          console.log("Prompt:", prompt);
          const completion = await this.generateCompletion(prompt, model, token);
  
          if (token.isCancellationRequested) {
            console.log("Request cancelled before completion");
            resolve(undefined);
            return;
          }
  
          const cleanedCompletion = cleanAIResponse(completion, document, position);
          console.log("Cleaned response:", cleanedCompletion);
          if (!cleanedCompletion) {
            console.log("No valid cleaned completion");
            resolve(undefined);
            return;
          }
  
          this.completionCache.set(cacheKey, {
            completion: cleanedCompletion,
            timestamp: Date.now(),
          });
          const uniqueCompletion = getUniqueCompletion(cleanedCompletion, linePrefix);
          console.log("Unique completion:", uniqueCompletion);
          if (uniqueCompletion) {
            const item = new vscode.InlineCompletionItem(uniqueCompletion, new vscode.Range(position, position));
            console.log("Returning completion item:", JSON.stringify(item));
            resolve([item]);
          } else {
            console.log("No unique completion available");
            resolve(undefined);
          }
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            console.log("Caught AbortError");
            resolve(undefined);
          } else {
            console.error("Completion error:", error);
            resolve(undefined);
          }
        }
      }, this.DEBOUNCE_DELAY);
    });
  }

  private async generateCompletion(
    prompt: string,
    model: string,
    token: vscode.CancellationToken
  ): Promise<string> {
    const request = {
      model: model,
      stream: true as const,
      messages: [
        {
          role: "system",
          content:
            "You are a code completion assistant like GitHub Copilot. RETURN ONLY THE RAW CODE COMPLETION. NO <THINK> BLOCKS, NO EXPLANATIONS, NO COMMENTS, NO MARKDOWN, NO PROSE. JUST THE EXACT CODE TO INSERT AT THE CURSOR.",
        },
        { role: "user", content: prompt },
      ],
    };

    let fullResponse = "";
    try {
      const response = await ollama.chat(request);
      this.currentResponse = response;

      for await (const part of response) {
        if (token.isCancellationRequested) {
          console.log("Request aborted during streaming");
          this.currentResponse.abort();
          this.currentResponse = null;
          return "";
        }
        if (part.message?.content) {
          fullResponse += part.message.content;
          console.log("Received stream:", part.message.content);
        }
      }
      console.log("Full response:", fullResponse);
      return fullResponse;
    } finally {
      this.currentResponse = null;
    }
  }
}