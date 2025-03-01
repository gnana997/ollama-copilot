import * as vscode from "vscode";

/**
 * Functions for detecting frameworks in the codebase
 */

/**
 * Gets the framework context based on the document content
 */
export function getFrameworkContext(
  document: vscode.TextDocument,
  position: vscode.Position,
  language: string
): string {
  const text = document.getText();
  
  // React detection
  if (text.includes('import React') || text.includes('from "react"') || text.includes("from 'react'")) {
    return 'Consider React patterns and hooks when appropriate.';
  }
  
  // Vue detection
  if (text.includes('import Vue') || text.includes('<template>') || document.fileName.endsWith('.vue')) {
    return 'Consider Vue.js component structure and lifecycle methods.';
  }
  
  // Angular detection
  if (text.includes('@Component') || text.includes('@NgModule') || text.includes('from "@angular/core"')) {
    return 'Consider Angular patterns, decorators, and dependency injection.';
  }
  
  // Express detection
  if (text.includes('express()') || text.includes('require("express")') || text.includes("require('express')")) {
    return 'Consider Express.js route handlers and middleware patterns.';
  }
  
  // Django detection
  if (language === 'python' && (text.includes('from django') || text.includes('django.') || text.includes('@login_required'))) {
    return 'Consider Django view patterns, ORM queries, and decorators.';
  }
  
  return '';
} 