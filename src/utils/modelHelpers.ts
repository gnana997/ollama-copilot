import ollama from 'ollama';
import * as vscode from 'vscode';

/**
 * Interface for model information
 */
export interface ModelInfo {
  label: string;
  details?: string;
}

/**
 * Gets the available Ollama models
 */
export async function getAvailableOllamaModels(): Promise<ModelInfo[]> {
  try {
    const response = await ollama.list();
    const availableModels = response.models.map((model) => {
      return {
        label: model.name,
        details: model.details ? `${model.details.family || ''} ${model.details.parameter_size || ''}`.trim() : ''
      };
    });
    return availableModels;
  } catch (error) {
    console.error('Error getting Ollama models:', error);
    vscode.window.showErrorMessage(`Failed to get Ollama models: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Gets the selected model from configuration
 */
export async function getSelectedModel(): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration('ollama');
  const selectedModel = config.get<string>('defaultModel');
  
  if (selectedModel) {
    return selectedModel;
  }
  
  const availableModels = await getAvailableOllamaModels();
  if (availableModels.length === 0) {
    vscode.window.showWarningMessage('No Ollama models found');
    return undefined;
  }
  
  const model = await vscode.window.showQuickPick(availableModels, {
    placeHolder: 'Select a model',
    matchOnDetail: true,
  });
  
  if (model) {
    await config.update('ollama.defaultModel', model.label, true);
    vscode.window.showInformationMessage(`Selected model: ${model.label}`);
    return model.label;
  }
  
  return undefined;
} 