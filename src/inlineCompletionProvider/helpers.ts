import * as vscode from "vscode";

/**
 * Helper functions for the inline completion provider
 */

/**
 * Extracts the variable name from a line of code
 */
export function extractVariableName(line: string): string | undefined {
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

/**
 * Gets the existing properties in an object literal
 */
export function getExistingProperties(
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

/**
 * Finds variables in scope at the current position
 */
export function findVariablesInScope(
  document: vscode.TextDocument,
  position: vscode.Position
): string[] {
  const variables = new Set<string>();
  const fullText = document.getText();
  const lines = fullText.split('\n');
  
  // Scan backwards to find variable declarations
  for (let i = position.line; i >= Math.max(0, position.line - 30); i--) {
    const line = lines[i];
    
    // Look for variable declarations
    const constMatches = line.matchAll(/const\s+(\w+)\s*=/g);
    const letMatches = line.matchAll(/let\s+(\w+)\s*=/g);
    const varMatches = line.matchAll(/var\s+(\w+)\s*=/g);
    
    for (const match of constMatches) {
      if (match[1]) variables.add(match[1]);
    }
    
    for (const match of letMatches) {
      if (match[1]) variables.add(match[1]);
    }
    
    for (const match of varMatches) {
      if (match[1]) variables.add(match[1]);
    }
    
    // Look for function parameters
    const funcMatches = line.matchAll(/function\s+\w+\s*\(([^)]*)\)/g);
    for (const match of funcMatches) {
      if (match[1]) {
        const params = match[1].split(',');
        for (const param of params) {
          const paramName = param.trim().split(':')[0].split('=')[0].trim();
          if (paramName) variables.add(paramName);
        }
      }
    }
  }
  
  // Add common objects that are always available
  variables.add('this');
  variables.add('window');
  variables.add('document');
  
  return Array.from(variables);
}

/**
 * Gets the file context for the current position
 */
export function getFileContext(
  document: vscode.TextDocument,
  position: vscode.Position
): string {
  // Get imports and relevant code context
  const fullText = document.getText();
  const lines = fullText.split("\n");
  const imports = lines
    .filter((line) => line.trim().startsWith("import"))
    .join("\n");

  // Get the current function/class context
  let contextStart = position.line;
  let bracketCount = 0;
  let inObjectLiteral = false;

  // Scan backwards to find the start of the current block/statement
  while (contextStart > 0) {
    const line = lines[contextStart].trim();

    // Count brackets to maintain context
    bracketCount += (line.match(/{/g) || []).length;
    bracketCount -= (line.match(/}/g) || []).length;

    // Check for object literal initialization
    if (line.includes("=") && line.includes("{")) {
      inObjectLiteral = true;
    }

    // Find the start of the current context
    if (
      bracketCount === 0 &&
      (line.startsWith("class") ||
        line.startsWith("function") ||
        line.startsWith("const") ||
        line.startsWith("let") ||
        line.startsWith("var") ||
        line.startsWith("interface") ||
        line.startsWith("type"))
    ) {
      break;
    }
    contextStart--;
  }

  const relevantLines = lines.slice(
    Math.max(0, contextStart - 5),
    position.line + 1
  );
  return `${imports}\n\n${relevantLines.join("\n")}`;
}

/**
 * Gets the cursor context for the current position
 */
export function getCursorContext(
  document: vscode.TextDocument,
  position: vscode.Position
): string {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  const lineSuffix = currentLine.substring(position.character);
  
  // Get surrounding context
  const prevLine = position.line > 0 ? document.lineAt(position.line - 1).text.trim() : '';
  const nextLine = position.line < document.lineCount - 1 ? document.lineAt(position.line + 1).text.trim() : '';
  
  // Create a context string that includes:
  // 1. The current line's state (empty, has property, etc.)
  // 2. Previous line's ending (comma, brace, etc.)
  // 3. Next line's starting character
  return `${linePrefix.trim()}|${lineSuffix.trim()}|${prevLine.slice(-1)}|${nextLine.charAt(0)}`;
}

/**
 * Gets the context hash for caching
 */
export function getContextHash(
  document: vscode.TextDocument,
  position: vscode.Position
): string {
  const context = getFileContext(document, position);
  // Simple hash function for context
  return context
    .split("")
    .reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) >>> 0;
    }, 0)
    .toString(36);
}

/**
 * Extracts the function purpose from comments and naming patterns
 */
export function extractFunctionPurpose(
  document: vscode.TextDocument,
  position: vscode.Position,
  functionName: string
): string {
  // Look for comments above the function
  let purpose = '';
  let lineNo = position.line - 1;
  
  while (lineNo >= 0 && lineNo >= position.line - 5) {
    const line = document.lineAt(lineNo).text.trim();
    if (line.startsWith('//') || line.startsWith('#') || line.startsWith('*')) {
      // Extract comment content
      const commentContent = line.replace(/^[\/\/#*\s]+/, '').trim();
      if (commentContent) {
        purpose = commentContent + ' ' + purpose;
      }
    } else if (!line.startsWith('/*') && line !== '') {
      // Stop if we hit non-comment, non-empty line
      break;
    }
    lineNo--;
  }
  
  // If no comment found, try to infer from function name
  if (!purpose && functionName) {
    if (functionName.startsWith('get') || functionName.startsWith('fetch')) {
      purpose = 'Retrieves data';
    } else if (functionName.startsWith('set') || functionName.startsWith('update')) {
      purpose = 'Updates data';
    } else if (functionName.startsWith('create') || functionName.startsWith('add')) {
      purpose = 'Creates new data';
    } else if (functionName.startsWith('delete') || functionName.startsWith('remove')) {
      purpose = 'Removes data';
    } else if (functionName.startsWith('is') || functionName.startsWith('has') || functionName.startsWith('can')) {
      purpose = 'Checks a condition';
    } else if (functionName.startsWith('calc') || functionName.startsWith('compute')) {
      purpose = 'Performs a calculation';
    }
  }
  
  return purpose || 'Unknown purpose';
}

/**
 * Finds potential imports based on the document content
 */
export function findPotentialImports(text: string, document: vscode.TextDocument): string[] {
  const language = document.languageId;
  const potentialImports = new Set<string>();
  
  // This is a simplified approach - a real implementation would need more sophisticated analysis
  if (language === 'typescript' || language === 'javascript') {
    // Look for React components (capitalized identifiers)
    const componentMatches = text.match(/\b[A-Z]\w+\b/g) || [];
    for (const match of componentMatches) {
      if (!text.includes(`import ${match}`) && !text.includes(`function ${match}`)) {
        potentialImports.add(match);
      }
    }
    
    // Look for common libraries
    if (text.includes('useState') && !text.includes("from 'react'") && !text.includes('from "react"')) {
      potentialImports.add('react');
    }
    if (text.includes('useEffect') && !text.includes("from 'react'") && !text.includes('from "react"')) {
      potentialImports.add('react');
    }
  }
  
  return Array.from(potentialImports);
}

/**
 * Extracts the content from a comment
 */
export function extractCommentContent(line: string): string {
  // Remove comment markers
  return line
    .replace(/^\s*\/\/\s*/, '') // JavaScript/TypeScript/C#/Java
    .replace(/^\s*#\s*/, '') // Python/Ruby/Shell
    .replace(/^\s*--\s*/, '') // SQL
    .replace(/^\s*\/\*\s*/, '').replace(/\s*\*\/\s*$/, '') // Multi-line start/end
    .replace(/^\s*\*\s*/, '') // Multi-line middle
    .trim();
}

/**
 * Identifies the type of control structure
 */
export function identifyControlStructureType(line: string): string {
  if (line.includes('if')) return 'if';
  if (line.includes('else if')) return 'else if';
  if (line.includes('else')) return 'else';
  if (line.includes('for')) return 'for loop';
  if (line.includes('while')) return 'while loop';
  if (line.includes('switch')) return 'switch';
  if (line.includes('case')) return 'case';
  if (line.includes('try')) return 'try';
  if (line.includes('catch')) return 'catch';
  if (line.includes('finally')) return 'finally';
  return 'control structure';
}

/**
 * Gets the language context for the current position
 */
export function getLanguageContext(
  language: string,
  currentLine: string,
  isObjectLiteral: boolean
): string {
  interface LanguagePattern {
    objectProps: string[];
    typeAnnotations?: boolean;
    dictStyle?: boolean;
  }

  const commonPatterns: Record<string, LanguagePattern> = {
    typescript: {
      objectProps: ["string", "number", "boolean", "Date", "any", "unknown"],
      typeAnnotations: true,
    },
    javascript: {
      objectProps: ["string", "number", "boolean", "Date", "Object", "Array"],
      typeAnnotations: false,
    },
    python: {
      objectProps: ["str", "int", "float", "bool", "dict", "list"],
      dictStyle: true,
      typeAnnotations: false,
    },
    csharp: {
      objectProps: ["string", "int", "bool", "DateTime", "List<string>"],
      typeAnnotations: true,
    },
    java: {
      objectProps: ["String", "Integer", "Boolean", "Date", "List<String>"],
      typeAnnotations: true,
    },
    go: {
      objectProps: ["string", "int", "bool", "time.Time", "[]string"],
      typeAnnotations: true,
    },
    ruby: {
      objectProps: ["String", "Integer", "Boolean", "Time", "Array"],
      typeAnnotations: false,
    },
  };

  // Get the language pattern or default to typescript
  const langPattern = commonPatterns[language] || commonPatterns.typescript;

  if (isObjectLiteral) {
    // Extract variable name from the current line to provide context
    const varName = extractVariableName(currentLine);
    const varContext = varName
      ? ` The variable name '${varName}' suggests the expected properties.`
      : "";

    switch (language) {
      case "typescript":
      case "javascript":
        return `Complete the object properties with appropriate values.${varContext} Consider common properties like: ${langPattern.objectProps.join(
          ", "
        )}. ${
          langPattern.typeAnnotations
            ? "Include type annotations where appropriate."
            : ""
        } Use meaningful property names and values based on the context.`;
      case "python":
        return `Complete the dictionary key-value pairs with appropriate values.${varContext} Consider common types like: ${langPattern.objectProps.join(
          ", "
        )}. Use meaningful keys and values based on the context.`;
      case "java":
      case "csharp":
        return `Complete the object properties with appropriate values.${varContext} Use common types like: ${langPattern.objectProps.join(
          ", "
        )}. Include proper type declarations.`;
      case "go":
        return `Complete the struct fields with appropriate values.${varContext} Use common types like: ${langPattern.objectProps.join(
          ", "
        )}. Include type declarations.`;
      case "ruby":
        return `Complete the hash with appropriate key-value pairs.${varContext} Consider common types like: ${langPattern.objectProps.join(
          ", "
        )}.`;
      default:
        return `Complete the object/structure with appropriate values based on the context.${varContext}`;
    }
  }

  return `Complete the code with appropriate values and maintain consistent style with the codebase. ${
    langPattern.typeAnnotations
      ? "Include type annotations where appropriate."
      : ""
  }`;
}

/**
 * Removes object declaration from a completion
 */
export function removeObjectDeclaration(completion: string, linePrefix: string): string {
  // Extract the variable name from the line prefix
  const varName = extractVariableName(linePrefix);
  if (!varName) {
    return completion;
  }

  // Remove any matching object declarations
  const declarationPattern = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=\\s*{`, 'g');
  const assignmentPattern = new RegExp(`${varName}\\s*=\\s*{`, 'g');
  
  let cleaned = completion
    .replace(declarationPattern, '')
    .replace(assignmentPattern, '')
    .replace(/^\s*{/, '') // Remove opening brace
    .replace(/}\s*$/, '') // Remove closing brace
    .trim();

  // Ensure proper indentation
  if (cleaned) {
    const indentation = linePrefix.match(/^\s*/)?.[0] || '';
    cleaned = cleaned.split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => `${indentation}  ${line}`) // Add 2 spaces for object property indentation
      .join('\n');
  }

  return cleaned;
} 