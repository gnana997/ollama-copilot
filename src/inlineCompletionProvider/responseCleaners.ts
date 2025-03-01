import * as vscode from "vscode";
import { isInsideObjectLiteral, isInsideConsoleLog, isInsideStringLiteral } from "./contextDetectors";
import { extractVariableName, removeObjectDeclaration } from "./helpers";

/**
 * Functions for cleaning AI responses
 */

/**
 * Cleans the AI response based on the context
 */
export function cleanAIResponse(response: string): string {
  if (!response.trim()) {
    return '';
  }

  // Remove any thinking process or explanations
  response = response.replace(/<think>[\s\S]*?<\/think>/g, '');
  response = response.replace(/<.*?>/g, '');
  
  // Get the current context
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return response.trim();
  }
  
  const position = editor.selection.active;
  const document = editor.document;
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  
  console.log("Clean AI Response - Current line:", currentLine);
  console.log("Clean AI Response - Line prefix:", linePrefix);
  
  // Check what context we're in
  const isConsoleLog = isInsideConsoleLog(document, position);
  const isStringLiteral = isInsideStringLiteral(document, position);
  const isObjectLiteral = isInsideObjectLiteral(document, position);
  
  console.log("Clean AI Response - Context:", { isConsoleLog, isStringLiteral, isObjectLiteral });
  console.log("Clean AI Response - Raw response:", response);
  
  // Handle console.log completions
  if (isConsoleLog) {
    // If we're inside a string in console.log, just return the string content
    if (isStringLiteral) {
      // Remove quotes and explanations
      response = response.replace(/^['"`]/, '').replace(/['"`]$/, '');
      response = response.replace(/^.*?suggested message:?\s*/i, '');
      console.log("Clean AI Response - Cleaned console.log string:", response);
      return response.trim();
    } else {
      // For console.log arguments, clean up any extra parentheses or explanations
      response = response.replace(/^\s*\(/, '').replace(/\)\s*$/, '');
      response = response.replace(/^.*?suggested argument:?\s*/i, '');
      
      // If the response starts with a quote but doesn't end with one, add the closing quote
      if ((response.startsWith('"') || response.startsWith("'") || response.startsWith('`')) && 
          !(response.endsWith('"') || response.endsWith("'") || response.endsWith('`'))) {
        const quoteChar = response.charAt(0);
        response = response + quoteChar;
      }
      
      console.log("Clean AI Response - Cleaned console.log args:", response);
      return response.trim();
    }
  }
  
  // Handle string literal completions
  if (isStringLiteral) {
    // Remove quotes and explanations
    response = response.replace(/^['"`]/, '').replace(/['"`]$/, '');
    response = response.replace(/^.*?suggested completion:?\s*/i, '');
    response = response.replace(/^.*?suggested string:?\s*/i, '');
    
    // Remove any explanatory text that might be in the response
    response = response.replace(/^.*?example:?\s*/i, '');
    response = response.replace(/^.*?here's a:?\s*/i, '');
    response = response.replace(/^.*?you could use:?\s*/i, '');
    
    // Check if we're at the beginning of a string (right after the opening quote)
    const isAtStringStart = /['"`]$/.test(linePrefix);
    
    // If we're at the start of a string, make sure we don't include closing quotes
    if (isAtStringStart) {
      response = response.replace(/['"`]$/, '');
    }
    
    console.log("Clean AI Response - Cleaned string literal:", response);
    return response.trim();
  }
  
  // Handle object literal completions
  if (isObjectLiteral) {
    // Remove any variable declarations or assignments
    response = response.replace(/(?:const|let|var)\s+\w+\s*=\s*{/g, '');
    response = response.replace(/\w+\s*=\s*{/g, '');
    response = response.replace(/^\s*{\s*/, ''); // Remove opening brace
    response = response.replace(/\s*}\s*$/, ''); // Remove closing brace
    
    // Clean up common formatting issues
    response = response.replace(/"\s*:\s*"/g, '": "'); // Normalize object property spacing
    response = response.replace(/{\s+}/g, '{}'); // Clean empty objects
    response = response.replace(/\(\s+\)/g, '()'); // Clean empty parentheses
    response = response.replace(/\[\s+\]/g, '[]'); // Clean empty arrays
    
    // Clean up property suggestions
    response = response.replace(/\/\/.*/g, ''); // Remove comments
    response = response.replace(/["'].*?["']\s*:/g, match => match.replace(/["']/g, '')); // Remove quotes around property names
    response = response.replace(/,\s*$/gm, ','); // Ensure consistent comma placement
    
    // Extract a single property suggestion if multiple are provided
    const lines = response.split('\n')
      .map(line => line.trim())
      .filter(line => {
        // Filter out lines that look like declarations or full objects
        return line && 
          !line.startsWith('/') && 
          !line.startsWith('{') && 
          !line.startsWith('}') &&
          !line.match(/(?:const|let|var)\s+\w+\s*=/) &&
          !line.match(/\w+\s*=\s*{/);
      });

    if (lines.length > 0) {
      // Return only the first valid property suggestion
      const suggestion = lines[0];
      // Ensure it's a valid property and ends with a comma
      if (suggestion.includes(':')) {
        const [propName] = suggestion.split(':');
        if (propName.trim()) {
          // Check for property repetition
          if (propName.trim().includes(propName.trim())) {
            // If property name is repeated, extract just the first instance
            const cleanProp = propName.trim().split(/\s+/)[0];
            const restOfSuggestion = suggestion.substring(suggestion.indexOf(':'));
            return `${cleanProp}${restOfSuggestion}`;
          }
          return suggestion.endsWith(',') ? suggestion : suggestion + ',';
        }
      }
    }
    
    return '';
  }
  
  // For general code completions, just clean up any explanations
  response = response.replace(/^.*?suggested code:?\s*/i, '');
  return response.trim();
}

/**
 * Gets a unique completion based on the context
 */
export function getUniqueCompletion(
  completion: string,
  linePrefix: string
): string | undefined {
  // Handle empty or invalid completions
  if (!completion.trim()) {
    return undefined;
  }

  // Get the current context
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return completion.trim();
  }
  
  const position = editor.selection.active;
  const document = editor.document;
  
  // Check what context we're in
  const isConsoleLog = isInsideConsoleLog(document, position);
  const isStringLiteral = isInsideStringLiteral(document, position);
  const isObjectLiteral = isInsideObjectLiteral(document, position);
  
  // Handle console.log completions
  if (isConsoleLog) {
    // For console.log, just return the cleaned completion
    return completion;
  }
  
  // Handle string literal completions
  if (isStringLiteral) {
    // For string literals, just return the cleaned completion
    return completion;
  }

  // Handle object literal completions
  if (isObjectLiteral) {
    // Remove any object declaration prefixes from the completion
    const cleanedCompletion = removeObjectDeclaration(completion, linePrefix);
    if (!cleanedCompletion) {
      return undefined;
    }

    // If we're inside an object literal and the completion is a property
    if (cleanedCompletion.includes(':')) {
      // If the line already has content, make sure we're not duplicating
      if (linePrefix.trim()) {
        if (linePrefix.trim().endsWith(',')) {
          // If line ends with comma, start a new line with proper indentation
          const indentation = linePrefix.match(/^\s*/)?.[0] || '';
          return `\n${indentation}${cleanedCompletion}`;
        } else if (!linePrefix.includes(':')) {
          // If line doesn't have a colon yet, complete the current line
          return cleanedCompletion;
        }
      } else {
        // If line is empty, just return the completion with proper indentation
        return cleanedCompletion;
      }
    }

    return cleanedCompletion.trim() ? cleanedCompletion : undefined;
  }

  // For general code completions
  return completion.trim() ? completion : undefined;
} 