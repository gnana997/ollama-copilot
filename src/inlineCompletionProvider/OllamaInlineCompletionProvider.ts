import * as vscode from "vscode";
import ollama from "ollama";
import { LRUCache } from "../utils/LRUCache";
import { 
  isInsideObjectLiteral, 
  isInsideConsoleLog, 
  isInsideStringLiteral,
  shouldInvalidateCache
} from "./contextDetectors";
import { generatePrompt } from "./promptGenerators";
import { cleanAIResponse, getUniqueCompletion } from "./responseCleaners";
import { 
  getFileContext, 
  getCursorContext, 
  getContextHash 
} from "./helpers";

/**
 * Main provider class for Ollama inline completions
 */
export class OllamaInlineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private currentResponse: { abort: () => void } | null = null;
  private debounceTimeout: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 200; // ms
  private readonly completionCache: LRUCache<
    string,
    { completion: string; timestamp: number }
  >;
  private readonly CACHE_SIZE = 100;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  constructor() {
    this.completionCache = new LRUCache<
      string,
      { completion: string; timestamp: number }
    >(this.CACHE_SIZE);
  }

  /**
   * Clears the completion cache
   */
  public clearCache(): void {
    // Create a new cache instance to effectively clear the old one
    this.completionCache.clear();
    vscode.window.showInformationMessage('Ollama Copilot: Completion cache cleared');
  }

  private generateCacheKey(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string {
    const linePrefix = document
      .lineAt(position.line)
      .text.substring(0, position.character);
    const contextHash = getContextHash(document, position);
    const isInObject = isInsideObjectLiteral(document, position);
    const varName = this.extractVariableName(linePrefix) || '';
    const existingProps = Array.from(this.getExistingProperties(document, position)).join(',');
    const cursorContext = getCursorContext(document, position);
    
    // Include more context in the cache key to make it unique for each position and state
    return `${contextHash}:${varName}:${isInObject}:${position.line}:${position.character}:${existingProps}:${cursorContext}`;
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const linePrefix = document
      .lineAt(position.line)
      .text.substring(0, position.character);
    
    console.log("=== INLINE COMPLETION DEBUG ===");
    console.log("Line prefix:", linePrefix);
    
    // Check what context we're in
    const isObjectLiteral = isInsideObjectLiteral(document, position);
    const isConsoleLog = isInsideConsoleLog(document, position);
    const isStringLiteral = isInsideStringLiteral(document, position);
    
    console.log("Context detection:", { 
      isObjectLiteral, 
      isConsoleLog, 
      isStringLiteral 
    });
    
    // Generate a cache key based on the context
    let cacheKey = null;
    
    // Only use cache for non-object-literal, non-console-log, and non-string-literal completions
    // This prevents suggestion repetition issues
    if (!isObjectLiteral && !isConsoleLog && !isStringLiteral) {
      cacheKey = this.generateCacheKey(document, position);
      console.log("Cache key:", cacheKey);
      
      // Check cache
      const cachedResult = this.completionCache.get(cacheKey);
      if (cachedResult && Date.now() - cachedResult.timestamp < this.CACHE_TTL) {
        console.log("Found cached result:", cachedResult);
        
        // Check if we should invalidate the cache based on the current context
        const shouldInvalidate = shouldInvalidateCache(document, position);
        console.log("Should invalidate cache:", shouldInvalidate);
        
        if (!shouldInvalidate) {
          const uniqueCompletion = getUniqueCompletion(
            cachedResult.completion,
            linePrefix
          );
          console.log("Unique completion from cache:", uniqueCompletion);
          if (uniqueCompletion) {
            return [new vscode.InlineCompletionItem(uniqueCompletion)];
          }
        }
      } else {
        console.log("No valid cache entry found");
      }
    } else {
      console.log("Skipping cache for special context (object literal, console.log, or string literal)");
    }

    // Cancel any pending request
    if (this.currentResponse) {
      this.currentResponse.abort();
      this.currentResponse = null;
    }
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    return new Promise((resolve) => {
      this.debounceTimeout = setTimeout(async () => {
        try {
          const config = vscode.workspace.getConfiguration("ollama");
          const model = config.get<string>("defaultModel");

          if (!model) {
            vscode.window.showWarningMessage(
              "No Ollama model selected. Set 'ollama.defaultModel' in settings."
            );
            resolve(undefined);
            return;
          }

          const fileContext = getFileContext(document, position);
          const prompt = generatePrompt(fileContext, document, position);
          console.log("Generated prompt:", prompt);
          const completion = await this.generateCompletion(prompt, model);
          if (token.isCancellationRequested) {
            resolve(undefined);
            return;
          }

          const cleanedCompletion = cleanAIResponse(completion);
          console.log("Raw completion:", completion);
          console.log("Cleaned completion:", cleanedCompletion);
          
          if (!cleanedCompletion) {
            console.log("No cleaned completion available");
            resolve(undefined);
            return;
          }

          // Only cache non-special context completions
          if (cacheKey && !isObjectLiteral && !isConsoleLog && !isStringLiteral) {
            console.log("Caching completion");
            this.completionCache.set(cacheKey, {
              completion: cleanedCompletion,
              timestamp: Date.now(),
            });
          } else {
            console.log("Not caching completion due to context");
          }

          const uniqueCompletion = getUniqueCompletion(
            cleanedCompletion,
            linePrefix
          );
          console.log("Final unique completion:", uniqueCompletion);
          
          if (uniqueCompletion) {
            resolve([new vscode.InlineCompletionItem(uniqueCompletion)]);
          } else {
            console.log("No unique completion available");
            resolve(undefined);
          }
        } catch (error: unknown) {
          if (error instanceof Error && error.name === "AbortError") {
            console.log("Request aborted");
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
    model: string
  ): Promise<string> {
    const request = {
      model: model,
      stream: true as const,
      messages: [
        {
          role: "system",
          content:
            "You are a code completion assistant like GitHub Copilot. Provide direct, contextually relevant code completions. Focus on completing the current line or block while maintaining proper indentation. Never include explanations or comments. Respond only with the code completion itself.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    };

    let fullResponse = "";
    let lastResponseTime = Date.now();
    //const STREAM_TIMEOUT = 12000; // 5 seconds timeout for stream

    try {
      const response = await ollama.chat(request);
      this.currentResponse = response;

      // Iterate through the stream with timeout protection
      for await (const part of response) {
        if (part.message?.content) {
          fullResponse += part.message.content;
          lastResponseTime = Date.now();
        }
      }

      return fullResponse;
    } finally {
      this.currentResponse = null;
    }
  }

  // Helper methods that need to be kept in the provider class
  private extractVariableName(line: string): string | undefined {
    // Match variable declarations like 'const userDetails = {' or 'let data ='
    const match = line.match(/(?:const|let|var)\s+(\w+)\s*=/);
    if (match) {
      return match[1];
    }

    // Match assignments like 'this.userDetails = {' or 'self.data ='
    const assignMatch = line.match(/(?:this|self)\.(\w+)\s*=/);
    if (assignMatch) {
      return assignMatch[1];
    }

    // Match variable assignments like 'userDetails = {'
    const simpleMatch = line.match(/(\w+)\s*=/);
    return simpleMatch ? simpleMatch[1] : undefined;
  }

  private getExistingProperties(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Set<string> {
    const existingProps = new Set<string>();
    let lineNo = position.line;
    
    // Find the opening brace line
    let openBraceLine = lineNo;
    let bracketCount = 0;
    const bracketStack = [];
    
    // First, scan backward to find the opening brace
    while (openBraceLine >= 0) {
      const line = document.lineAt(openBraceLine).text;
      
      // Count brackets from right to left to find our object's opening brace
      for (let i = line.length - 1; i >= 0; i--) {
        const char = line[i];
        if (char === '}') bracketStack.push('}');
        else if (char === '{') {
          if (bracketStack.length > 0) bracketStack.pop();
          else {
            // This is our opening brace
            bracketCount = 1;
            break;
          }
        }
      }
      
      if (bracketCount > 0 || line.includes('{')) break;
      openBraceLine--;
    }
    
    // Now scan forward from the opening brace to current line to find all properties
    for (let i = openBraceLine; i <= position.line; i++) {
      const line = document.lineAt(i).text;
      
      // Extract property names using regex
      const propMatches = line.matchAll(/\b(\w+)\s*:/g);
      for (const match of propMatches) {
        if (match[1]) {
          existingProps.add(match[1]);
        }
      }
    }
    
    return existingProps;
  }
} 