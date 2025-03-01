// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import ollama from "ollama";
import { registerInlineCompletionProvider, completionProvider } from "./inlineCompletionProvider";
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration();
	let selectedModel = config.get<string>("ollama.defaultModel");

	if (!selectedModel) {
		await getSelectedModel();
	}
	registerInlineCompletionProvider(context);

	context.subscriptions.push(vscode.commands.registerCommand("ollama-copilot.selectDefaultModel", async () => {
		await getSelectedModel();
	}));
	
	// Register a command to clear the completion cache
	context.subscriptions.push(vscode.commands.registerCommand("ollama-copilot.clearCompletionCache", () => {
		if (completionProvider) {
			completionProvider.clearCache();
		} else {
			vscode.window.showWarningMessage("Ollama Copilot: Completion provider not initialized");
		}
	}));
}

async function getSelectedModel() {
	const config = vscode.workspace.getConfiguration();
	const availableModels = await getAvailableOllamaModels();

	if (availableModels.length === 0) {
		vscode.window.showWarningMessage("No models found");
		return;
	}

	const model = await vscode.window.showQuickPick(availableModels, {
		placeHolder: "Select a model",
		matchOnDetail: true,
	});

	if (model) {
		const selectedModel = model.label;
		await config.update("ollama.defaultModel", selectedModel, true);
		vscode.window.showInformationMessage(`Selected model: ${selectedModel}`);
	}
}


async function getAvailableOllamaModels() {
	const availableModels = (await ollama.list()).models.map((model) => {
		return { label: model.name, details: `${model.details.family} ${model.details.parameter_size}` };
	});
	return availableModels;
}


// This method is called when your extension is deactivated
export function deactivate() {}
