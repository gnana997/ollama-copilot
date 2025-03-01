/**
 * Functions for detecting file types based on extensions
 */

/**
 * Checks if the file is a Markdown file
 */
export function isMarkdownFile(extension: string): boolean {
  return ['md', 'markdown'].includes(extension);
}

/**
 * Checks if the file is an HTML file
 */
export function isHTMLFile(extension: string): boolean {
  return ['html', 'htm', 'xhtml', 'jsx', 'tsx', 'vue', 'svelte'].includes(extension);
}

/**
 * Checks if the file is a CSS file
 */
export function isCSSFile(extension: string): boolean {
  return ['css', 'scss', 'sass', 'less', 'styl'].includes(extension);
}

/**
 * Checks if the file is a JSON file
 */
export function isJSONFile(extension: string): boolean {
  return ['json', 'jsonc', 'json5'].includes(extension);
}

/**
 * Checks if the file is a SQL file
 */
export function isSQLFile(extension: string): boolean {
  return ['sql', 'mysql', 'pgsql', 'sqlite'].includes(extension);
} 