// promptGenerators.ts
import * as vscode from "vscode";
import { getFileContext, getLanguageContext, findVariablesInScope } from "./helpers";

export function generatePrompt(
  fileContext: string,
  document: vscode.TextDocument,
  position: vscode.Position
): string {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  const indentation = linePrefix.match(/^\s*/)?.[0] || "";
  const language = document.languageId;
  const variablesInScope = findVariablesInScope(document, position);

  const isInQuotes = /['"`]$/.test(linePrefix);
  const isAfterEquals = /=[\s]*$/.test(linePrefix);
  const isInBraces = /{$/.test(linePrefix.trim());
  const prevLine = position.line > 0 ? document.lineAt(position.line - 1).text.trim() : "";

  let prompt = `Complete this ${language} code:
Current line: "${linePrefix}"
Previous line: "${prevLine}"
Indentation: ${indentation.length} spaces
Variables in scope: ${variablesInScope.join(', ') || 'none'}
Context:
${fileContext}
RETURN ONLY THE CODE TO INSERT. NO EXPLANATIONS, NO <THINK> BLOCKS, NO COMMENTS, NO MARKDOWN. JUST THE RAW CODE.`;

  if (isInQuotes) {
    prompt += `\nCursor is inside a string literal. Return ONLY the string content, NO quotes.`;
  } else if (isInBraces) {
    prompt += `\nCursor is inside an object/block. Return ONE indented property/statement.`;
  } else if (isAfterEquals) {
    prompt += `\nCursor is after an assignment. Return a value or expression.`;
  }

  return prompt;
}