/**
 * @file VS Code extension entry point with dependency injection
 * @module extension
 * @description Main entry point for the Ollama Dev Companion VS Code extension.
 * Handles extension activation, service registration, and command setup.
 */

import * as vscode from 'vscode';
import { ServiceContainer, SERVICE_IDENTIFIERS } from './di';
import { registerServices, initializeServices } from './services/ServiceRegistration';
import {
  createChatPanelFactory,
  createCompletionProviderFactory,
  createViewProviderFactory,
  ChatPanelFactory
} from './services/factories';
import { isFunction } from './types/guards';
import {
  IConfigurationService,
  IModelService,
  ICompletionService,
  IValidationService,
  IMemoryMonitor,
  IPerformanceMonitor,
  IResourceManager,
  IRateLimiter,
  IErrorHandlerService
} from './services/interfaces';
import { GlobalErrorBoundary } from './utils/GlobalErrorBoundary';
import { Logger } from './utils/logger';

/**
 * Global dependency injection container instance
 * @private
 */
let container: ServiceContainer | undefined;

/**
 * Global output channel for extension logging
 * @private
 */
let outputChannel: vscode.OutputChannel;

/**
 * Activates the Ollama Dev Companion extension
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @returns {Promise<void>} Promise that resolves when activation is complete
 * @throws {Error} If extension activation fails
 * @example
 * ```typescript
 * // This function is called automatically by VS Code when the extension is activated
 * // No manual invocation needed
 * ```
 * @since 0.1.0
 */
export async function activate(context: vscode.ExtensionContext) {
  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel('Ollama Copilot');
  outputChannel.show();
  outputChannel.appendLine('=== Ollama Copilot Extension Activation ===');
  outputChannel.appendLine(`Activation time: ${new Date().toISOString()}`);
  outputChannel.appendLine('Activating Ollama Copilot with dependency injection...');
  
  // Make output channel available globally
  (global as any).ollamaOutputChannel = outputChannel;
  
  // Initialize logger
  Logger.initialize(outputChannel);
  
  try {
    // Create DI container
    outputChannel.appendLine('Creating DI container...');
    container = new ServiceContainer();
    
    // Register all services
    outputChannel.appendLine('Registering services...');
    registerServices(container);
    
    // Initialize services
    outputChannel.appendLine('Initializing services...');
    await initializeServices(container);
    
    // Initialize global error boundary
    const errorHandler = container.resolve<IErrorHandlerService>(SERVICE_IDENTIFIERS.IErrorHandlerService);
    const errorBoundary = GlobalErrorBoundary.initialize(errorHandler, {
      showNotifications: true,
      logToConsole: true,
      offerRecovery: true,
      maxErrors: 5,
      errorWindow: 60000
    });
    errorBoundary.activate();
    context.subscriptions.push(new vscode.Disposable(() => errorBoundary.deactivate()));
    
    // Create factories
    const completionProviderFactory = createCompletionProviderFactory(container);
    const viewProviderFactory = createViewProviderFactory(container);
    const chatPanelFactory = createChatPanelFactory(container);
    
    // Register completion provider
    completionProviderFactory.register(context);
    
    // Register sidebar chat view
    outputChannel.appendLine('Registering sidebar chat view...');
    viewProviderFactory.registerSidebarChat(context, context.extensionUri);
    outputChannel.appendLine('✓ Sidebar chat view registered');
    
    // Register commands
    registerCommands(context, container, chatPanelFactory);
    
    // Set up configuration change listener
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('ollama')) {
          handleConfigurationChange(container!);
        }
      })
    );
    
    // Add command to manually refresh models
    context.subscriptions.push(
      vscode.commands.registerCommand('ollama-copilot.refreshModels', async () => {
        outputChannel.appendLine('Manual model refresh requested...');
        try {
          if (!container) {
            throw new Error('Extension not fully initialized');
          }
          const modelService = container.resolve<IModelService>(SERVICE_IDENTIFIERS.IModelService);
          await modelService.refreshModels();
          outputChannel.appendLine('✓ Models refreshed successfully');
          vscode.window.showInformationMessage('Ollama models refreshed successfully');
        } catch (error) {
          outputChannel.appendLine(`✗ Failed to refresh models: ${error}`);
          vscode.window.showErrorMessage(`Failed to refresh models: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );
    
    // Set up memory monitoring
    setupMemoryMonitoring(context, container);
    
    outputChannel.appendLine('✓ Ollama Copilot activated successfully with dependency injection');
    outputChannel.appendLine('=== Activation Complete ===');
    
  } catch (error) {
    outputChannel.appendLine(`✗ Failed to activate Ollama Copilot: ${error}`);
    console.error('Failed to activate Ollama Copilot:', error);
    vscode.window.showErrorMessage(
      `Failed to activate Ollama Copilot: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Registers all extension commands with VS Code
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @param {ServiceContainer} container - Dependency injection container
 * @returns {void}
 * @private
 * @description Registers commands for:
 * - Model selection
 * - Cache management
 * - Chat operations
 * - Configuration updates
 * - Performance monitoring
 * - Resource management
 */
function registerCommands(context: vscode.ExtensionContext, container: ServiceContainer, chatPanelFactory: ChatPanelFactory): void {
  const modelService = container.resolve<IModelService>(SERVICE_IDENTIFIERS.IModelService);
  const completionService = container.resolve<ICompletionService>(SERVICE_IDENTIFIERS.ICompletionService);
  const validationService = container.resolve<IValidationService>(SERVICE_IDENTIFIERS.IValidationService);
  const configService = container.resolve<IConfigurationService>(SERVICE_IDENTIFIERS.IConfigurationService);
  
  // Select default model command
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-copilot.selectDefaultModel', async () => {
      const models = await modelService.getAvailableModels();
      
      if (models.length === 0) {
        vscode.window.showWarningMessage('No Ollama models found. Please install at least one model.');
        return;
      }
      
      const items = models.map(model => ({
        label: model.name,
        description: model.details?.parameter_size,
        detail: `Modified: ${new Date(model.modified_at).toLocaleString()}`
      }));
      
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a default model',
        matchOnDescription: true,
        matchOnDetail: true
      });
      
      if (selected) {
        await modelService.setSelectedModel(selected.label);
        vscode.window.showInformationMessage(`Default model set to: ${selected.label}`);
      }
    })
  );
  
  // Clear completion cache command
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-copilot.clearCompletionCache', () => {
      completionService.clearCache();
      vscode.window.showInformationMessage('Completion cache cleared');
    })
  );
  
  // Search available models command
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-copilot.searchavailablemodels', async () => {
      const models = await modelService.getAvailableModels();
      
      if (models.length === 0) {
        vscode.window.showInformationMessage('No Ollama models found');
        return;
      }
      
      const modelList = models.map(model => 
        `${model.name} (${model.details?.parameter_size || 'Unknown size'})`
      ).join('\\n');
      
      vscode.window.showInformationMessage(`Available models:\\n${modelList}`);
    })
  );
  
  // Open chat panel command
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-copilot.openChatPanel', () => {
      chatPanelFactory.createOrShow(context.extensionUri);
    })
  );
  
  // Update Ollama host command
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-copilot.updateOllamaHost', async () => {
      const currentHost = configService.get<string>('apiHost', 'http://localhost:11434');
      
      const host = await vscode.window.showInputBox({
        prompt: 'Enter the new Ollama API host URL',
        value: currentHost,
        validateInput: async (value) => {
          if (!value) {return 'Host URL is required';}
          
          const result = validationService.validateUrl(value, {
            allowedProtocols: ['http:', 'https:'],
            requireHttps: false
          });
          
          if (!result.isValid) {
            return result.errors[0]?.message || 'Invalid URL';
          }
          
          return null;
        }
      });
      
      if (host) {
        await configService.update('apiHost', host);
        vscode.window.showInformationMessage('Ollama host updated successfully');
      }
    })
  );
  
  // Memory management commands
  const memoryMonitor = container.tryResolve<IMemoryMonitor>(SERVICE_IDENTIFIERS.IMemoryMonitor);
  
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-copilot.showMemoryStats', () => {
      if (memoryMonitor && isFunction(memoryMonitor.showReport)) {
        memoryMonitor.showReport();
      }
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-copilot.forceGarbageCollection', () => {
      if (memoryMonitor && isFunction(memoryMonitor.forceGarbageCollection)) {
        memoryMonitor.forceGarbageCollection();
      }
    })
  );
  
  // Resource status command
  const resourceManager = container.tryResolve<IResourceManager>(SERVICE_IDENTIFIERS.IResourceManager);
  
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-copilot.showResourceStatus', () => {
      if (resourceManager && isFunction(resourceManager.showStatus)) {
        resourceManager.showStatus();
      }
    })
  );
  
  // Performance commands
  const perfMonitor = container.tryResolve<IPerformanceMonitor>(SERVICE_IDENTIFIERS.IPerformanceMonitor);
  
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-copilot.showPerformanceReport', () => {
      if (perfMonitor && isFunction(perfMonitor.showReport)) {
        perfMonitor.showReport();
      }
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-copilot.exportPerformanceMetrics', async () => {
      if (perfMonitor && isFunction(perfMonitor.exportMetrics)) {
        await perfMonitor.exportMetrics();
      }
    })
  );
  
  // Validation commands
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-copilot.showValidationStats', () => {
      const stats = validationService.getValidationStats();
      const message = `
Total validations: ${stats.totalValidations}
Validations by field: ${JSON.stringify(stats.validationsByField, null, 2)}
      `;
      vscode.window.showInformationMessage(message, { modal: true });
    })
  );
  
  // Rate limit commands
  const rateLimiter = container.tryResolve<IRateLimiter>(SERVICE_IDENTIFIERS.IRateLimiter);
  
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-copilot.showRateLimitStatus', () => {
      if (rateLimiter && isFunction(rateLimiter.getStats)) {
        const stats = rateLimiter.getStats();
        const quickPick = vscode.window.createQuickPick();
        quickPick.title = 'Rate Limit Status';
        quickPick.items = Object.entries(stats.keys).map(([key, status]: [string, any]) => ({
          label: key,
          description: `${status.requests}/${status.limit} requests`,
          detail: status.blocked ? 
            `Blocked until: ${new Date(status.blockedUntil).toLocaleTimeString()}` : 
            `Resets at: ${new Date(status.resetAt).toLocaleTimeString()}`
        }));
        quickPick.show();
      }
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-copilot.resetRateLimits', () => {
      if (rateLimiter && isFunction(rateLimiter.reset)) {
        rateLimiter.reset();
        vscode.window.showInformationMessage('Rate limits have been reset');
      }
    })
  );

  // File operations command
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-copilot.showFileOperations', () => {
      if (resourceManager && isFunction(resourceManager.showStatus)) {
        // Show resource status which includes file operations
        resourceManager.showStatus();
      } else {
        // Fallback: show basic information about current file operations
        const stats = resourceManager?.getStats();
        if (stats) {
          const message = `Active File Operations:
Total resources: ${stats.totalResources}
Resources by type: ${Object.entries(stats.resourcesByType)
            .map(([type, count]) => `${type}: ${count}`)
            .join(', ') || 'None'}
${stats.oldestResource ? `Oldest: ${stats.oldestResource.toLocaleString()}` : ''}
${stats.newestResource ? `Newest: ${stats.newestResource.toLocaleString()}` : ''}`;
          
          vscode.window.showInformationMessage(message, { modal: true });
        } else {
          vscode.window.showInformationMessage('No active file operations found');
        }
      }
    })
  );

  // Validate configuration command
  context.subscriptions.push(
    vscode.commands.registerCommand('ollama-copilot.validateConfiguration', async () => {
      try {
        const result = await configService.validate();
        
        if (result.isValid) {
          vscode.window.showInformationMessage('Configuration is valid');
        } else {
          const errorDetails = result.errors
            .map(error => `${error.section}.${error.key}: ${error.message}`)
            .join('\n');
          
          const choice = await vscode.window.showWarningMessage(
            `Configuration validation found ${result.errors.length} issue(s)`,
            { modal: true },
            'Show Details',
            'Fix Issues'
          );
          
          if (choice === 'Show Details') {
            vscode.window.showInformationMessage(
              `Configuration Errors:\n${errorDetails}`,
              { modal: true }
            );
          } else if (choice === 'Fix Issues') {
            // Open settings to allow user to fix issues
            await vscode.commands.executeCommand('workbench.action.openSettings', 'ollama');
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to validate configuration: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );
}

/**
 * Handles configuration change events
 * @param {ServiceContainer} container - Dependency injection container
 * @returns {void}
 * @private
 * @description Services automatically react to configuration changes through the ConfigurationService events
 */
function handleConfigurationChange(_container: ServiceContainer): void {
  // Configuration service will handle its own updates through events
  // Other services that depend on configuration will react accordingly
  console.log('Configuration changed, services will update automatically');
}

/**
 * Sets up memory monitoring and automatic cleanup
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @param {ServiceContainer} container - Dependency injection container
 * @returns {void}
 * @private
 * @description Configures:
 * - Memory usage monitoring
 * - Automatic cache cleanup on critical alerts
 * - Resource cleanup for old/unused resources
 * - Memory alert notifications
 */
function setupMemoryMonitoring(_context: vscode.ExtensionContext, container: ServiceContainer): void {
  const memoryMonitor = container.tryResolve<IMemoryMonitor>(SERVICE_IDENTIFIERS.IMemoryMonitor);
  const configService = container.resolve<IConfigurationService>(SERVICE_IDENTIFIERS.IConfigurationService);
  const completionService = container.resolve<ICompletionService>(SERVICE_IDENTIFIERS.ICompletionService);
  const resourceManager = container.tryResolve<IResourceManager>(SERVICE_IDENTIFIERS.IResourceManager);
  
  if (!memoryMonitor || !isFunction(memoryMonitor.onAlert)) {
    return;
  }
  
  // Start memory monitoring if enabled
  const memoryConfig = configService.getSection('memory');
  if (memoryConfig.enableMonitoring) {
    const interval = Number(memoryConfig.monitoringInterval) || 30000;
    if (isFunction(memoryMonitor.startMonitoring)) {
      memoryMonitor.startMonitoring(interval);
    }
  }
  
  // Set up memory alerts
  memoryMonitor.onAlert((alert: any) => {
    console.error(`Memory alert: ${alert.type} - ${alert.message}`);
    
    // On critical alert, try to free up memory
    if (alert.type === 'critical') {
      // Clear completion cache
      completionService.clearCache();
      
      // Clean up old resources
      if (resourceManager && isFunction(resourceManager.cleanupOldResources)) {
        const cleaned = resourceManager.cleanupOldResources(5 * 60 * 1000); // 5 minutes
        if (cleaned > 0) {
          vscode.window.showInformationMessage(
            `Freed memory by cleaning up ${cleaned} old resources`
          );
        }
      }
    }
  });
}

/**
 * Deactivates the Ollama Dev Companion extension
 * @returns {Promise<void>} Promise that resolves when deactivation is complete
 * @description Performs cleanup:
 * - Disposes all services in the container
 * - Clears global state
 * - Runs garbage collection if available
 * @example
 * ```typescript
 * // This function is called automatically by VS Code when the extension is deactivated
 * // No manual invocation needed
 * ```
 * @since 0.1.0
 */
export async function deactivate() {
  console.log('Deactivating Ollama Copilot...');
  
  try {
    if (container) {
      // Dispose the container, which will dispose all services
      container.dispose();
      container = undefined;
    }
    
    // Force garbage collection if available
    if (global.gc) {
      console.log('Running final garbage collection...');
      global.gc();
    }
    
    console.log('Ollama Copilot deactivated successfully');
  } catch (error) {
    console.error('Error during extension deactivation:', error);
  }
}