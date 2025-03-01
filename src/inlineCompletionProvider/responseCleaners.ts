// responseCleaners.ts
import * as vscode from "vscode";

export function cleanAIResponse(
  response: string,
  document: vscode.TextDocument,
  position: vscode.Position
): string {
  if (!response.trim()) {return "";}

  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  const indentation = linePrefix.match(/^\s*/)?.[0] || "";

  // Extract only the first valid code-like line
  let cleaned = response
    .replace(/<think>[\s\S]*?(<\/think>|$)/gi, '') // Remove <think> blocks
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/#.*/g, '') // Remove Python-style comments
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && /^[a-zA-Z0-9'"`{}=+\-*/.;[\]()]+$/.test(line)) // Only code-like content
    .shift() || ""; // Take first valid line

  // Context-specific adjustments
  if (/['"`]$/.test(linePrefix)) {
    cleaned = cleaned.replace(/['"`]/g, ''); // Strip quotes for string literals
  } else if (/{$/.test(linePrefix.trim())) {
    cleaned = `${indentation}  ${cleaned}`; // Indent for blocks
  } else if (linePrefix.trim().endsWith('=')) {
    cleaned = cleaned.replace(/;\s*$/, ''); // Remove trailing semicolon after =
  }

  return cleaned;
}

export function getUniqueCompletion(completion: string, linePrefix: string): string | undefined {
  if (!completion.trim()) {return undefined;}
  const prefixTrimmed = linePrefix.trim();
  if (prefixTrimmed && completion.startsWith(prefixTrimmed)) {
    return completion.substring(prefixTrimmed.length).trim();
  }
  return completion;
}