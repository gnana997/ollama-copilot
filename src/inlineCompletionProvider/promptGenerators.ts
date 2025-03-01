import * as vscode from "vscode";
import { 
  isInsideObjectLiteral, 
  isInsideConsoleLog, 
  isInsideStringLiteral,
  isInsideFunctionDeclaration,
  isInsideClassDeclaration,
  isInsideImportStatement,
  isInsideComment,
  isInsideControlStructure
} from "./contextDetectors";
import {
  isMarkdownFile,
  isHTMLFile,
  isCSSFile,
  isJSONFile,
  isSQLFile
} from "./fileTypeDetectors";
import { getFrameworkContext } from "./frameworkDetectors";
import {
  extractVariableName,
  getExistingProperties,
  findVariablesInScope,
  getFileContext,
  getLanguageContext,
  extractFunctionPurpose,
  findPotentialImports,
  extractCommentContent,
  identifyControlStructureType
} from "./helpers";

/**
 * Functions for generating prompts for different contexts
 */

/**
 * Generates a prompt for the current context
 */
export function generatePrompt(
  fileContext: string,
  document: vscode.TextDocument,
  position: vscode.Position
): string {
  const currentLine = document
    .lineAt(position.line)
    .text.substring(0, position.character);
  const indentation = currentLine.match(/^\s*/)?.[0] || "";
  const language = document.languageId;
  const fileName = document.fileName;
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

  // Detect different contexts
  const isObjectLiteral = isInsideObjectLiteral(document, position);
  const isConsoleLog = isInsideConsoleLog(document, position);
  const isStringLiteral = isInsideStringLiteral(document, position);
  const isFunctionDeclaration = isInsideFunctionDeclaration(document, position);
  const isClassDeclaration = isInsideClassDeclaration(document, position);
  const isImportStatement = isInsideImportStatement(document, position);
  const isComment = isInsideComment(document, position);
  const isControlStructure = isInsideControlStructure(document, position);

  // Handle special file types
  if (isMarkdownFile(fileExtension)) {
    return generateMarkdownPrompt(document, position, fileContext);
  }
  
  if (isHTMLFile(fileExtension)) {
    return generateHTMLPrompt(document, position, fileContext);
  }
  
  if (isCSSFile(fileExtension)) {
    return generateCSSPrompt(document, position, fileContext);
  }
  
  if (isJSONFile(fileExtension)) {
    return generateJSONPrompt(document, position, fileContext);
  }
  
  if (isSQLFile(fileExtension)) {
    return generateSQLPrompt(document, position, fileContext);
  }

  // Handle code comments (high priority as they might contain instructions)
  if (isComment) {
    return generateCommentToCodePrompt(document, position, fileContext, language);
  }

  // Handle import statements
  if (isImportStatement) {
    return generateImportPrompt(document, position, fileContext, language);
  }

  // Handle function declarations
  if (isFunctionDeclaration) {
    return generateFunctionPrompt(document, position, fileContext, language);
  }

  // Handle class declarations
  if (isClassDeclaration) {
    return generateClassPrompt(document, position, fileContext, language);
  }

  // Handle control structures
  if (isControlStructure) {
    return generateControlStructurePrompt(document, position, fileContext, language);
  }

  // Handle console.log statements
  if (isConsoleLog) {
    return generateConsoleLogPrompt(document, position, fileContext, language);
  }

  // Handle string literals
  if (isStringLiteral) {
    return generateStringLiteralPrompt(document, position, fileContext, language);
  }

  // Handle object literals
  if (isObjectLiteral) {
    // Get the line content after removing indentation
    const lineContent = currentLine.trim();
    const nextLine =
      position.line < document.lineCount - 1
        ? document.lineAt(position.line + 1).text
        : "";

    // Check if we're at the start of an empty object
    const isEmptyObject =
      (lineContent.endsWith("{") || lineContent.includes("= {")) &&
      (!nextLine.trim() || nextLine.trim() === "}");

    const varName = extractVariableName(currentLine);
    const varNameLower = varName?.toLowerCase() || "";

    // Get existing properties to avoid duplicates
    const existingProps = getExistingProperties(document, position);

    if (isEmptyObject || lineContent.trim() === '') {
      // For empty objects or new lines, suggest properties
      const varAnalysis = {
        isUserRelated:
          varNameLower.includes("user") || varNameLower.includes("account"),
        isConfigRelated:
          varNameLower.includes("config") || varNameLower.includes("setting"),
        isTimeRelated:
          varNameLower.includes("time") || varNameLower.includes("date"),
      };

      const patterns = {
        hasNestedStructure:
          lineContent.includes("description") ||
          lineContent.includes("config"),
        hasDateField:
          lineContent.includes("date") || lineContent.includes("created"),
        hasIdField:
          lineContent.includes("id") || varNameLower.endsWith("details"),
        hasTypeField:
          lineContent.includes("type") || lineContent.includes("kind"),
      };

      return generateObjectPrompt(
        language,
        varName || "",
        indentation,
        varAnalysis,
        patterns,
        fileContext,
        existingProps
      );
    }
  }

  // For other cases, use the standard prompt with enhanced language context
  const langContext = getLanguageContext(
    language,
    currentLine,
    isObjectLiteral
  );
  
  // Check for framework-specific context
  const frameworkContext = getFrameworkContext(document, position, language);
  
  return `Complete the following ${language} code. ${langContext} ${frameworkContext}
Maintain the current indentation level (${indentation.length} spaces). 
Provide only the completion, no explanations.
Context:
${fileContext}`;
}

/**
 * Generates a prompt for console.log statements
 */
export function generateConsoleLogPrompt(
  document: vscode.TextDocument,
  position: vscode.Position,
  fileContext: string,
  language: string
): string {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  
  // Extract what's already in the console.log
  const consoleLogContent = linePrefix.substring(linePrefix.indexOf('console.log(') + 'console.log('.length);
  
  // Check if we're inside quotes
  const isInString = isInsideStringLiteral(document, position);
  
  if (isInString) {
    // We're completing a string inside console.log
    return `Complete the string inside this console.log statement.
Provide a meaningful message based on the context.
Do not add closing quotes or parentheses.
Context:
${fileContext}`;
  } else {
    // We're completing arguments to console.log
    // Find variables in scope that could be logged
    const variablesInScope = findVariablesInScope(document, position);
    
    return `Complete this console.log statement with appropriate values.
Consider logging these variables that appear to be in scope: ${variablesInScope.join(', ')}
You can suggest string messages, variables, or expressions.
Do not add closing parentheses.
Context:
${fileContext}`;
  }
}

/**
 * Generates a prompt for string literals
 */
export function generateStringLiteralPrompt(
  document: vscode.TextDocument,
  position: vscode.Position,
  fileContext: string,
  language: string
): string {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  
  console.log("String literal prompt generation:");
  console.log("Current line:", currentLine);
  console.log("Line prefix:", linePrefix);
  
  // Determine the type of string content based on context
  let stringPurpose = "general";
  
  if (currentLine.includes('console.log')) {
    stringPurpose = "log";
  } else if (currentLine.includes('error') || currentLine.includes('Error')) {
    stringPurpose = "error";
  } else if (currentLine.includes('message') || currentLine.includes('msg')) {
    stringPurpose = "message";
  } else if (currentLine.includes('url') || currentLine.includes('URL')) {
    stringPurpose = "url";
  } else if (currentLine.includes('name') || currentLine.match(/\bname\b/)) {
    stringPurpose = "name";
  } else if (currentLine.includes('email')) {
    stringPurpose = "email";
  } else if (currentLine.includes('phone')) {
    stringPurpose = "phone";
  } else if (currentLine.includes('address')) {
    stringPurpose = "address";
  } else if (currentLine.includes('description') || currentLine.includes('desc')) {
    stringPurpose = "description";
  } else if (currentLine.includes('title')) {
    stringPurpose = "title";
  } else if (currentLine.includes('id') || currentLine.includes('ID')) {
    stringPurpose = "id";
  }
  
  console.log("Detected string purpose:", stringPurpose);
  
  // Extract variable name if available
  const varNameMatch = currentLine.match(/(?:const|let|var)\s+(\w+)\s*=/);
  const varName = varNameMatch ? varNameMatch[1] : '';
  console.log("Variable name:", varName);
  
  // Generate appropriate prompt based on string purpose
  let prompt = '';
  
  switch (stringPurpose) {
    case "log":
      prompt = `Complete this log message with a clear description of what's being logged.`;
      break;
    case "error":
      prompt = `Complete this error message with a descriptive error explanation.`;
      break;
    case "message":
      prompt = `Complete this message with appropriate text for user communication.`;
      break;
    case "url":
      prompt = `Complete this URL with a valid path structure.`;
      break;
    case "name":
      prompt = `Complete this name string with a realistic person name.`;
      break;
    case "email":
      prompt = `Complete this email with a valid email address format.`;
      break;
    case "phone":
      prompt = `Complete this phone number with a valid format.`;
      break;
    case "address":
      prompt = `Complete this address with a realistic street address.`;
      break;
    case "description":
      prompt = `Complete this description with appropriate descriptive text.`;
      break;
    case "title":
      prompt = `Complete this title with a concise and meaningful title.`;
      break;
    case "id":
      prompt = `Complete this ID with an appropriate identifier format.`;
      break;
    default:
      // For variable name-based suggestions
      if (varName) {
        if (varName.toLowerCase().includes('name')) {
          prompt = `Complete this name string with a realistic person name.`;
        } else if (varName.toLowerCase().includes('email')) {
          prompt = `Complete this email with a valid email address format.`;
        } else if (varName.toLowerCase().includes('phone')) {
          prompt = `Complete this phone number with a valid format.`;
        } else if (varName.toLowerCase().includes('address')) {
          prompt = `Complete this address with a realistic street address.`;
        } else if (varName.toLowerCase().includes('description') || varName.toLowerCase().includes('desc')) {
          prompt = `Complete this description with appropriate descriptive text.`;
        } else if (varName.toLowerCase().includes('title')) {
          prompt = `Complete this title with a concise and meaningful title.`;
        } else if (varName.toLowerCase().includes('id')) {
          prompt = `Complete this ID with an appropriate identifier format.`;
        } else if (varName.toLowerCase().includes('url')) {
          prompt = `Complete this URL with a valid path structure.`;
        } else if (varName.toLowerCase().includes('message') || varName.toLowerCase().includes('msg')) {
          prompt = `Complete this message with appropriate text.`;
        } else {
          prompt = `Complete this string with appropriate content for a variable named '${varName}'.`;
        }
      } else {
        prompt = `Complete this string with appropriate content based on the context.`;
      }
  }
  
  const finalPrompt = `${prompt}
Do not include quotes in your response.
Context:
${fileContext}`;

  console.log("Generated string prompt:", finalPrompt);
  return finalPrompt;
}

/**
 * Generates a prompt for object literals
 */
export function generateObjectPrompt(
  language: string,
  varName: string,
  indentation: string,
  varAnalysis: { isUserRelated: boolean; isConfigRelated: boolean; isTimeRelated: boolean },
  patterns: { hasNestedStructure: boolean; hasDateField: boolean; hasIdField: boolean; hasTypeField: boolean },
  fileContext: string,
  existingProps: Set<string>
): string {
  const baseIndent = " ".repeat(indentation.length + 2);
  
  // Suggest common properties based on variable name
  let suggestedProps = [];
  
  if (varAnalysis.isUserRelated) {
    suggestedProps = ["id", "name", "email", "username", "firstName", "lastName", "age", "address", "phone", "created", "updated", "isActive"];
  } else if (varAnalysis.isConfigRelated) {
    suggestedProps = ["enabled", "value", "type", "description", "default", "options", "version", "path", "timeout"];
  } else if (varAnalysis.isTimeRelated) {
    suggestedProps = ["created", "updated", "timestamp", "date", "time", "timezone", "duration"];
  } else {
    // Generic properties
    suggestedProps = ["id", "name", "type", "value", "description", "status", "enabled"];
  }
  
  // Filter out existing properties
  const availableProps = suggestedProps.filter(prop => !existingProps.has(prop));
  
  return `Complete only the properties inside the object literal for '${varName}'.
Do not repeat the variable declaration or object braces.
Do not suggest these existing properties: ${Array.from(existingProps).join(', ')}.
Use this exact indentation: "${baseIndent}" for each property.
Start each property on a new line.
Include the property name, type annotation, and trailing comma.
Consider the variable name and context when suggesting properties.
Provide only one property at a time.
Suggested properties you can use (choose one): ${availableProps.join(', ')}

Current context:
${fileContext}`;
}

/**
 * Generates a prompt for function declarations
 */
export function generateFunctionPrompt(
  document: vscode.TextDocument,
  position: vscode.Position,
  fileContext: string,
  language: string
): string {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  
  // Extract function name and parameters
  let functionName = '';
  const functionMatch = linePrefix.match(/(?:function|def|func)\s+(\w+)/);
  if (functionMatch) {
    functionName = functionMatch[1];
  }
  
  // Look for clues about the function's purpose
  const purposeClues = extractFunctionPurpose(document, position, functionName);
  
  return `Complete this function declaration in ${language}.
Function name: ${functionName}
Purpose: ${purposeClues}
Suggest appropriate parameters, return type, and function body.
Do not include explanatory comments in the completion.
Context:
${fileContext}`;
}

/**
 * Generates a prompt for class declarations
 */
export function generateClassPrompt(
  document: vscode.TextDocument,
  position: vscode.Position,
  fileContext: string,
  language: string
): string {
  const currentLine = document.lineAt(position.line).text;
  
  // Extract class name
  let className = '';
  const classMatch = currentLine.match(/class\s+(\w+)/);
  if (classMatch) {
    className = classMatch[1];
  }
  
  return `Complete this class declaration in ${language}.
Class name: ${className}
Suggest appropriate properties, methods, and constructor.
Follow standard patterns for ${language} classes.
Context:
${fileContext}`;
}

/**
 * Generates a prompt for import statements
 */
export function generateImportPrompt(
  document: vscode.TextDocument,
  position: vscode.Position,
  fileContext: string,
  language: string
): string {
  // Analyze the file to find what might need to be imported
  const fullText = document.getText();
  const undefinedIdentifiers = findPotentialImports(fullText, document);
  
  return `Complete this import statement in ${language}.
Consider these identifiers that may need importing: ${undefinedIdentifiers.join(', ')}
Suggest appropriate module paths based on the context.
Context:
${fileContext}`;
}

/**
 * Generates a prompt for comments to code
 */
export function generateCommentToCodePrompt(
  document: vscode.TextDocument,
  position: vscode.Position,
  fileContext: string,
  language: string
): string {
  const currentLine = document.lineAt(position.line).text;
  const commentContent = extractCommentContent(currentLine);
  
  return `Generate code based on this comment in ${language}:
"${commentContent}"
Implement a solution that addresses the comment's requirements.
Provide only the implementation code, no explanations.
Context:
${fileContext}`;
}

/**
 * Generates a prompt for control structures
 */
export function generateControlStructurePrompt(
  document: vscode.TextDocument,
  position: vscode.Position,
  fileContext: string,
  language: string
): string {
  const currentLine = document.lineAt(position.line).text;
  const structureType = identifyControlStructureType(currentLine);
  
  return `Complete this ${structureType} structure in ${language}.
Suggest an appropriate body for this control structure.
Follow best practices for ${language} ${structureType} blocks.
Context:
${fileContext}`;
}

/**
 * Generates a prompt for Markdown files
 */
export function generateMarkdownPrompt(
  document: vscode.TextDocument,
  position: vscode.Position,
  fileContext: string
): string {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  
  // Determine what kind of markdown element we're dealing with
  const isList = /^\s*[-*+]\s/.test(linePrefix);
  const isHeading = /^\s*#{1,6}\s/.test(linePrefix);
  const isCodeBlock = linePrefix.includes('```');
  const isTable = /^\s*\|.*\|\s*$/.test(linePrefix);
  
  let contextType = 'general markdown';
  if (isList) contextType = 'list item';
  if (isHeading) contextType = 'heading';
  if (isCodeBlock) contextType = 'code block';
  if (isTable) contextType = 'table';
  
  return `Complete this ${contextType} in Markdown.
Suggest appropriate content that follows Markdown formatting rules.
Context:
${fileContext}`;
}

/**
 * Generates a prompt for HTML files
 */
export function generateHTMLPrompt(
  document: vscode.TextDocument,
  position: vscode.Position,
  fileContext: string
): string {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  
  // Check if we're inside a tag
  const isInsideTag = /<[^>]*$/.test(linePrefix);
  const isInsideAttribute = /\s\w+=['"]?[^'"]?$/.test(linePrefix);
  
  if (isInsideTag && !isInsideAttribute) {
    return `Complete this HTML tag.
Suggest appropriate attributes for this tag.
Context:
${fileContext}`;
  } else if (isInsideAttribute) {
    return `Complete this HTML attribute value.
Suggest an appropriate value for this attribute.
Context:
${fileContext}`;
  } else {
    return `Complete this HTML content.
Suggest appropriate tags or content.
Context:
${fileContext}`;
  }
}

/**
 * Generates a prompt for CSS files
 */
export function generateCSSPrompt(
  document: vscode.TextDocument,
  position: vscode.Position,
  fileContext: string
): string {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character);
  
  // Check if we're inside a property or selector
  const isInsideProperty = /^\s*[\w-]+\s*:\s*[^;]*$/.test(linePrefix);
  const isInsideSelector = /^\s*[^{]*$/.test(linePrefix) && !isInsideProperty;
  
  if (isInsideProperty) {
    // Extract the property name
    const propertyMatch = linePrefix.match(/^\s*([\w-]+)\s*:/);
    const propertyName = propertyMatch ? propertyMatch[1] : '';
    
    return `Complete this CSS property value.
Property: ${propertyName}
Suggest an appropriate value for this CSS property.
Context:
${fileContext}`;
  } else if (isInsideSelector) {
    return `Complete this CSS selector.
Suggest an appropriate selector based on the context.
Context:
${fileContext}`;
  } else {
    return `Complete this CSS rule.
Suggest appropriate properties and values.
Context:
${fileContext}`;
  }
}

/**
 * Generates a prompt for JSON files
 */
export function generateJSONPrompt(
  document: vscode.TextDocument,
  position: vscode.Position,
  fileContext: string
): string {
  // Try to determine the schema based on filename or content
  const fileName = document.fileName.toLowerCase();
  let schemaType = 'generic JSON';
  
  if (fileName.includes('package.json')) {
    schemaType = 'package.json';
  } else if (fileName.includes('tsconfig.json')) {
    schemaType = 'tsconfig.json';
  } else if (fileName.includes('.vscode/settings.json')) {
    schemaType = 'VS Code settings';
  }
  
  return `Complete this ${schemaType} content.
Suggest valid JSON that follows the ${schemaType} schema.
Ensure proper formatting with correct commas and quotes.
Context:
${fileContext}`;
}

/**
 * Generates a prompt for SQL files
 */
export function generateSQLPrompt(
  document: vscode.TextDocument,
  position: vscode.Position,
  fileContext: string
): string {
  const currentLine = document.lineAt(position.line).text;
  const linePrefix = currentLine.substring(0, position.character).toUpperCase();
  
  // Determine the type of SQL statement
  let statementType = 'SQL';
  if (linePrefix.includes('SELECT')) statementType = 'SELECT';
  if (linePrefix.includes('INSERT')) statementType = 'INSERT';
  if (linePrefix.includes('UPDATE')) statementType = 'UPDATE';
  if (linePrefix.includes('DELETE')) statementType = 'DELETE';
  if (linePrefix.includes('CREATE TABLE')) statementType = 'CREATE TABLE';
  if (linePrefix.includes('ALTER TABLE')) statementType = 'ALTER TABLE';
  
  return `Complete this ${statementType} statement.
Suggest appropriate SQL syntax for this ${statementType} operation.
Use proper SQL formatting with correct clauses and conditions.
Context:
${fileContext}`;
} 