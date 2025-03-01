import * as vscode from "vscode";

/**
 * Functions for detecting the context of the cursor position
 */

/**
 * Checks if the cursor is inside an object literal
 */
export function isInsideObjectLiteral(
  document: vscode.TextDocument,
  position: vscode.Position
): boolean {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);

  // Check if we're in an object literal initialization
  if (linePrefix.includes("{")) {
    const matches = linePrefix.match(/[{}\[\]()]/g) || [];
    let bracketCount = 0;
    for (const match of matches) {
      if (match === "{" || match === "[" || match === "(") bracketCount++;
      if (match === "}" || match === "]" || match === ")") bracketCount--;
    }
    return bracketCount > 0;
  }

  // Check previous lines if we might be inside an object
  let lineNo = position.line - 1;
  let bracketCount = 0;
  while (lineNo >= 0 && lineNo >= position.line - 5) {
    const line = document.lineAt(lineNo).text;
    const matches = line.match(/[{}\[\]()]/g) || [];
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      if (match === "{" || match === "[" || match === "(") bracketCount++;
      if (match === "}" || match === "]" || match === ")") bracketCount--;
    }
    if (line.includes("=") && bracketCount > 0) {
      return true;
    }
    lineNo--;
  }
  return false;
}

/**
 * Checks if the cursor is inside a console.log statement
 */
export function isInsideConsoleLog(
  document: vscode.TextDocument,
  position: vscode.Position
): boolean {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  
  // Check if we're inside a console.log statement
  return linePrefix.includes('console.log(') && !currentLine.substring(0, position.character).endsWith(')');
}

/**
 * Checks if the cursor is inside a string literal
 */
export function isInsideStringLiteral(
  document: vscode.TextDocument,
  position: vscode.Position
): boolean {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  
  console.log("String literal detection:");
  console.log("Current line:", currentLine);
  console.log("Line prefix:", linePrefix);
  
  // Check for variable assignment to string
  const isStringAssignment = /(?:const|let|var|=)\s+\w+\s*=\s*(['"`])/.test(currentLine);
  console.log("Is string assignment:", isStringAssignment);
  
  // Check if cursor is right after an opening quote
  const isAfterOpeningQuote = /['"`]$/.test(linePrefix);
  console.log("Is after opening quote:", isAfterOpeningQuote);
  
  // Check if we're in an empty string (cursor between quotes)
  const isInEmptyString = (/['"`]\s*['"`]/.test(currentLine)) && 
                          (linePrefix.endsWith("'") || 
                           linePrefix.endsWith('"') || 
                           linePrefix.endsWith('`'));
  console.log("Is in empty string:", isInEmptyString);
  
  // Count quotes to determine if we're inside a string
  const singleQuotes = (linePrefix.match(/'/g) || []).length;
  const doubleQuotes = (linePrefix.match(/"/g) || []).length;
  const backticks = (linePrefix.match(/`/g) || []).length;
  
  console.log("Quote counts:", { singleQuotes, doubleQuotes, backticks });
  
  // If there's an odd number of any quote type, we're inside a string
  const isInString = (singleQuotes % 2 !== 0) || (doubleQuotes % 2 !== 0) || (backticks % 2 !== 0);
  console.log("Is inside string:", isInString);
  
  // Additional check for assignment to empty string
  const isEmptyStringAssignment = /=\s*['"`]$/.test(linePrefix);
  console.log("Is empty string assignment:", isEmptyStringAssignment);
  
  // Check if the line contains a string assignment and the cursor is after the equals sign
  const stringAssignmentMatch = currentLine.match(/(\w+)\s*=\s*(['"`])/);
  const isAfterEqualsInStringAssignment = stringAssignmentMatch !== null && 
                                         linePrefix.includes('=') && 
                                         linePrefix.indexOf('=') < position.character;
  console.log("Is after equals in string assignment:", isAfterEqualsInStringAssignment);
  
  return isInString || isEmptyStringAssignment || isAfterOpeningQuote || 
         (isStringAssignment && isAfterEqualsInStringAssignment);
}

/**
 * Checks if the cursor is inside a function declaration
 */
export function isInsideFunctionDeclaration(
  document: vscode.TextDocument,
  position: vscode.Position
): boolean {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  
  // Check for function declarations in various languages
  const functionPatterns = [
    /function\s+\w*\s*\([^)]*$/, // JavaScript/TypeScript function
    /def\s+\w*\s*\([^)]*$/, // Python function
    /public\s+\w+\s+\w+\s*\([^)]*$/, // Java/C# method
    /func\s+\w*\s*\([^)]*$/, // Go function
    /sub\s+\w*\s*\([^)]*$/, // Perl/VB function
    /fn\s+\w*\s*\([^)]*$/, // Rust function
  ];
  
  return functionPatterns.some(pattern => pattern.test(linePrefix));
}

/**
 * Checks if the cursor is inside a class declaration
 */
export function isInsideClassDeclaration(
  document: vscode.TextDocument,
  position: vscode.Position
): boolean {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  
  // Check for class declarations in various languages
  const classPatterns = [
    /class\s+\w*\s*{?$/, // JavaScript/TypeScript/Java class
    /class\s+\w*\s*\(.*\)\s*:?$/, // Python class
    /interface\s+\w*\s*{?$/, // TypeScript/Java interface
    /struct\s+\w*\s*{?$/, // Go/C struct
    /enum\s+\w*\s*{?$/, // TypeScript/Java/C# enum
  ];
  
  return classPatterns.some(pattern => pattern.test(linePrefix));
}

/**
 * Checks if the cursor is inside an import statement
 */
export function isInsideImportStatement(
  document: vscode.TextDocument,
  position: vscode.Position
): boolean {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  
  // Check for import statements in various languages
  const importPatterns = [
    /import\s+.*$/, // JavaScript/TypeScript/Java import
    /from\s+.*\s+import\s+.*$/, // Python import
    /require\s*\(.*$/, // Node.js require
    /using\s+.*$/, // C# using
    /#include\s+.*$/, // C/C++ include
  ];
  
  return importPatterns.some(pattern => pattern.test(linePrefix));
}

/**
 * Checks if the cursor is inside a comment
 */
export function isInsideComment(
  document: vscode.TextDocument,
  position: vscode.Position
): boolean {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  
  // Check for comments in various languages
  const commentPatterns = [
    /^\s*\/\/.*$/, // Single line comment (JS, TS, Java, C#, etc.)
    /^\s*#.*$/, // Python/Ruby/Shell comment
    /^\s*--.*$/, // SQL comment
    /^\s*\/\*(?!\*\/).*$/, // Start of multi-line comment
    /^\s*\*(?!\/).*$/, // Middle of multi-line comment
  ];
  
  return commentPatterns.some(pattern => pattern.test(linePrefix));
}

/**
 * Checks if the cursor is inside a control structure
 */
export function isInsideControlStructure(
  document: vscode.TextDocument,
  position: vscode.Position
): boolean {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  
  // Check for control structures in various languages
  const controlPatterns = [
    /if\s*\(.*\)\s*{?$/, // if statement
    /else\s*{?$/, // else statement
    /else\s+if\s*\(.*\)\s*{?$/, // else if statement
    /for\s*\(.*\)\s*{?$/, // for loop
    /while\s*\(.*\)\s*{?$/, // while loop
    /switch\s*\(.*\)\s*{?$/, // switch statement
    /case\s+.*:$/, // case statement
    /try\s*{?$/, // try block
    /catch\s*\(.*\)\s*{?$/, // catch block
    /finally\s*{?$/, // finally block
  ];
  
  return controlPatterns.some(pattern => pattern.test(linePrefix));
}

/**
 * Checks if a cache should be invalidated based on the current context
 */
export function shouldInvalidateCache(
  document: vscode.TextDocument,
  position: vscode.Position
): boolean {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  
  // Invalidate cache if:
  // 1. Line already has a property
  // 2. Line has changed significantly
  // 3. Cursor is at a different position type (empty line vs property line)
  return (
    linePrefix.includes(':') ||
    linePrefix.trim().length === 0 ||
    isNewPropertyLine(document, position)
  );
}

/**
 * Checks if the current line is a new property line in an object
 */
export function isNewPropertyLine(
  document: vscode.TextDocument,
  position: vscode.Position
): boolean {
  const currentLine = document.lineAt(position.line).text.trim();
  const prevLine = position.line > 0 ? document.lineAt(position.line - 1).text.trim() : '';
  
  // Consider it a new property line if:
  // 1. Previous line ends with a comma
  // 2. Current line is empty
  // 3. We're on a new line after a property
  return (
    prevLine.endsWith(',') ||
    currentLine === '' ||
    (prevLine.includes(':') && !currentLine.includes(':'))
  );
} 