(function () {
  // Get VS Code API
  const vscode = acquireVsCodeApi();
  
  // Elements
  const modelSelect = document.getElementById('model-select');
  const addFileBtn = document.getElementById('add-file-btn');
  const selectCodeBtn = document.getElementById('select-code-btn');
  const useWorkspaceCheckbox = document.getElementById('use-workspace');
  const contextFilesList = document.getElementById('context-files-list');
  const chatMessages = document.getElementById('chat-messages');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  
  // State
  let contextFiles = [];
  let isLoading = false;
  
  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    // Restore any previous state
    const state = vscode.getState() || { messages: [] };
    
    // Render messages from state
    if (state.messages) {
      state.messages.forEach(message => {
        addMessageToUI(message.role, message.content);
      });
    }
    
    // Restore context files if any
    if (state.contextFiles) {
      contextFiles = state.contextFiles;
      updateContextFilesUI();
    }
  });
  
  // Handle model selection
  modelSelect.addEventListener('change', () => {
    vscode.postMessage({
      type: 'selectModel',
      model: modelSelect.value
    });
  });
  
  // Handle add file button
  addFileBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'addFileContext' });
  });
  
  // Handle select code button
  selectCodeBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'selectCodeForContext' });
  });
  
  // Handle send button
  sendButton.addEventListener('click', sendMessage);
  
  // Handle enter key in message input
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Send a message
  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || isLoading) return;
    
    vscode.postMessage({
      type: 'sendMessage',
      text,
      contextFiles,
      useWorkspace: useWorkspaceCheckbox.checked
    });
    
    // Clear input
    messageInput.value = '';
  }
  
  // Update the UI with context files
  function updateContextFilesUI() {
    contextFilesList.innerHTML = '';
    
    if (contextFiles.length === 0) {
      return;
    }
    
    contextFiles.forEach((file, index) => {
      const li = document.createElement('li');
      
      const fileName = file.split('/').pop();
      li.textContent = fileName;
      
      const removeBtn = document.createElement('span');
      removeBtn.textContent = '×';
      removeBtn.className = 'context-file-remove';
      removeBtn.addEventListener('click', () => {
        contextFiles.splice(index, 1);
        updateContextFilesUI();
        updateState();
      });
      
      li.appendChild(removeBtn);
      contextFilesList.appendChild(li);
    });
    
    updateState();
  }
  
  // Add a message to the UI
  function addMessageToUI(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    
    // Process markdown-like code blocks in the content
    content = content.replace(/```([a-z]*)\n([\s\S]*?)```/g, function(match, language, code) {
      return `<pre><code class="language-${language}">${escapeHtml(code)}</code></pre>`;
    });
    
    // Process inline code
    content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    messageDiv.innerHTML = content;
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Update state
    updateState();
  }
  
  // Escape HTML to prevent XSS
  function escapeHtml(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }
  
  // Show loading indicator
  function showLoading(loading) {
    isLoading = loading;
    
    if (loading) {
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'loading-indicator';
      loadingDiv.id = 'loading-indicator';
      
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      
      const text = document.createElement('span');
      text.textContent = 'Processing...';
      
      loadingDiv.appendChild(spinner);
      loadingDiv.appendChild(text);
      
      chatMessages.appendChild(loadingDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      
      // Disable input while loading
      messageInput.disabled = true;
      sendButton.disabled = true;
    } else {
      // Remove loading indicator
      const loadingIndicator = document.getElementById('loading-indicator');
      if (loadingIndicator) {
        loadingIndicator.remove();
      }
      
      // Enable input
      messageInput.disabled = false;
      sendButton.disabled = false;
      messageInput.focus();
    }
  }
  
  // Show an error message
  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    chatMessages.appendChild(errorDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      errorDiv.style.opacity = '0';
      setTimeout(() => errorDiv.remove(), 500);
    }, 5000);
  }
  
  // Update the state
  function updateState() {
    const messages = Array.from(chatMessages.children)
      .filter(el => el.classList.contains('chat-message'))
      .map(el => {
        return {
          role: el.classList.contains('user') ? 'user' : 'assistant',
          content: el.innerHTML
        };
      });
    
    vscode.setState({ messages, contextFiles });
  }
  
  // Handle messages from the extension
  window.addEventListener('message', (event) => {
    const message = event.data;
    
    switch (message.type) {
      case 'updateModelInfo':
        // Populate model selection dropdown
        modelSelect.innerHTML = '';
        message.models.forEach(model => {
          const option = document.createElement('option');
          option.value = model.label;
          option.textContent = model.label;
          if (model.details) {
            option.title = model.details;
          }
          if (model.label === message.selectedModel) {
            option.selected = true;
          }
          modelSelect.appendChild(option);
        });
        break;
        
      case 'addMessage':
        addMessageToUI(message.role, message.content);
        break;
        
      case 'updateContextFiles':
        contextFiles = message.files;
        updateContextFilesUI();
        break;
        
      case 'addCodeSelection':
        const codeContext = `Selected code from ${message.fileName}:\n\`\`\`\n${message.code}\n\`\`\``;
        messageInput.value = messageInput.value ? `${messageInput.value}\n\n${codeContext}` : codeContext;
        messageInput.focus();
        break;
        
      case 'setLoading':
        showLoading(message.loading);
        break;
        
      case 'showError':
        showError(message.message);
        break;
    }
  });
})(); 