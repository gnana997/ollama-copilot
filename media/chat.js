(function () {
  // Immediately log the document readiness
  console.log('Chat.js loaded, document.readyState:', document.readyState);
  
  // Add global error handler
  window.onerror = function(message, source, lineno, colno, error) {
    console.error('JavaScript error:', message);
    console.error('Error details:', {source, lineno, colno});
    console.error('Error object:', error);
    return false;
  };
  
  // Get VS Code API
  const vscode = acquireVsCodeApi();
  
  // Log when the document is ready
  function checkElementsExist() {
    console.log('Checking DOM elements...');
    const elements = {
      'model-select': document.getElementById('model-select'),
      'add-file-btn': document.getElementById('add-file-btn'),
      'select-code-btn': document.getElementById('select-code-btn'),
      'use-workspace': document.getElementById('use-workspace'),
      'context-files-list': document.getElementById('context-files-list'),
      'chat-messages': document.getElementById('chat-messages'),
      'message-input': document.getElementById('message-input'),
      'send-button': document.getElementById('send-button'),
      'new-chat-btn': document.getElementById('new-chat-btn'),
    };
    
    // Log each element status
    for (const [id, element] of Object.entries(elements)) {
      console.log(`Element #${id}: ${element ? 'Found' : 'NOT FOUND'}`);
    }
  }
  
  // Check elements as soon as possible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkElementsExist);
  } else {
    checkElementsExist();
  }
  
  // Elements - declare variables that will be initialized when DOM is ready
  let modelSelect;
  let addFileBtn;
  let selectCodeBtn;
  let useWorkspaceCheckbox;
  let contextFilesList;
  let chatMessages;
  let messageInput;
  let sendButton;
  let newChatBtn;
  
  // Initialize elements once DOM is ready
  function initializeElements() {
    modelSelect = document.getElementById('model-select');
    addFileBtn = document.getElementById('add-file-btn');
    selectCodeBtn = document.getElementById('select-code-btn');
    useWorkspaceCheckbox = document.getElementById('use-workspace');
    contextFilesList = document.getElementById('context-files-list');
    chatMessages = document.getElementById('chat-messages');
    messageInput = document.getElementById('message-input');
    sendButton = document.getElementById('send-button');
    newChatBtn = document.getElementById('new-chat-btn');
    
    console.log('Elements initialized:', {
      modelSelect, addFileBtn, selectCodeBtn, useWorkspaceCheckbox,
      contextFilesList, chatMessages, messageInput, sendButton, newChatBtn
    });
    
    // Now that elements are initialized, set up event listeners
    setupEventListeners();
  }
  
  // Set up event listeners for UI elements
  function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Check if elements exist
    if (!modelSelect || !newChatBtn || !addFileBtn || !selectCodeBtn || 
        !sendButton || !messageInput || !useWorkspaceCheckbox) {
      console.error('Not all UI elements found. Cannot set up event listeners properly.');
      console.log('Elements status:', {
        modelSelect: !!modelSelect,
        newChatBtn: !!newChatBtn,
        addFileBtn: !!addFileBtn,
        selectCodeBtn: !!selectCodeBtn,
        sendButton: !!sendButton,
        messageInput: !!messageInput,
        useWorkspaceCheckbox: !!useWorkspaceCheckbox
      });
      return;
    }
  
    // Handle model selection
    modelSelect.addEventListener('change', () => {
      vscode.postMessage({
        type: 'selectModel',
        model: modelSelect.value
      });
    });
    
    // Handle new chat button
    newChatBtn.addEventListener('click', () => {
      console.log('New chat button clicked');
      vscode.postMessage({ type: 'newChat' });
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
    sendButton.addEventListener('click', (e) => {
      console.log('Send button clicked');
      e.preventDefault(); // Prevent any default form submission
      sendMessage();
    });
    
    // Handle enter key in message input
    messageInput.addEventListener('keydown', (e) => {
      console.log('Key pressed in message input:', e.key);
      if (e.key === 'Enter' && !e.shiftKey) {
        console.log('Enter key pressed (without shift)');
        e.preventDefault();
        sendMessage();
      }
    });
  }
  
  // State
  let contextFiles = [];
  let isLoading = false;
  
  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded, initializing chat UI');
    
    // Wait for a brief moment to ensure the DOM is fully rendered
    setTimeout(() => {
      // Initialize DOM elements
      initializeElements();
      
      // Check if elements were found
      console.log('Model select element:', modelSelect);
      console.log('Chat messages element:', chatMessages);
      console.log('Send button element:', sendButton);
      console.log('Message input element:', messageInput);
      
      // Test clicking the send button programmatically
      if (sendButton) {
        console.log('Adding a test click handler to the send button');
        sendButton.onclick = function(e) {
          console.log('Send button clicked via onclick property');
          sendMessage();
        };
        
        // Add a direct event listener as a backup approach
        document.getElementById('send-button')?.addEventListener('click', function(e) {
          console.log('Send button clicked via direct getElementById');
          sendMessage();
        });
      }
      
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
      
      // Request model information directly after initialization
      console.log('Requesting models from extension...');
      vscode.postMessage({
        type: 'requestModels'
      });
    }, 100); // 100ms delay to ensure DOM is ready
  });
  
  // Send a message
  function sendMessage() {
    // Check if all required elements exist
    if (!messageInput || !useWorkspaceCheckbox) {
      console.error('Required elements missing for message sending');
      
      // Try to re-initialize elements
      initializeElements();
      
      if (!messageInput || !useWorkspaceCheckbox) {
        console.error('Failed to initialize required elements for sending message');
        return;
      }
    }
    
    const text = messageInput.value.trim();
    if (!text || isLoading) return;
    
    console.log('Sending message:', text);
    console.log('Context files:', contextFiles);
    console.log('Use workspace:', useWorkspaceCheckbox.checked);
    
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
  
  // Show loading indicator
  function showLoading(loading) {
    console.log('Setting loading state to:', loading);
    isLoading = loading;
    
    if (loading) {
        // Check if loading indicator already exists
        let loadingDiv = document.getElementById('loading-indicator');
        if (loadingDiv) {
            console.log('Loading indicator already exists, making sure it is visible');
            loadingDiv.style.display = 'flex';
            return;
        }
        
        console.log('Creating loading indicator');
        loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-indicator';
        loadingDiv.id = 'loading-indicator';
        loadingDiv.style.display = 'flex';
        
        // Create header container
        const headerDiv = document.createElement('div');
        headerDiv.className = 'loading-indicator-header';
        
        // Create left side of header (spinner, text)
        const leftDiv = document.createElement('div');
        leftDiv.className = 'loading-indicator-left';
        
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        
        const text = document.createElement('span');
        text.textContent = 'Thinking...';
        
        leftDiv.appendChild(spinner);
        leftDiv.appendChild(text);
        
        // Create right side with stop button
        const stopButton = document.createElement('button');
        stopButton.textContent = 'Stop';
        stopButton.className = 'stop-button';
        stopButton.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Stop generation button clicked in chat.js');
            vscode.postMessage({
                type: 'stopGeneration'
            });
        });
        
        // Add left and right sides to header
        headerDiv.appendChild(leftDiv);
        headerDiv.appendChild(stopButton);
        
        // Add header to loading indicator
        loadingDiv.appendChild(headerDiv);
        
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Disable input while loading
        messageInput.disabled = true;
        sendButton.disabled = true;
    } else {
        console.log('Removing loading indicator');
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
  
  // Update streaming message with new content
  function updateStreamingMessage(content) {
    console.log('Updating streaming message with content length:', content.length);
    
    // Update both the streaming message and the loading content
    const streamingMessage = document.getElementById('streaming-message');
    const loadingContent = document.getElementById('loading-content');
    
    if (!content || content.trim() === '') {
      console.log('Empty content received, skipping update');
      return;
    }
    
    // Process markdown-like code blocks in the content
    let formattedContent = content.replace(/```([a-z]*)\n([\s\S]*?)```/g, function(match, language, code) {
      return `<pre><code class="language-${language}">${escapeHtml(code)}</code></pre>`;
    });
    
    // Process inline code
    formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Update streaming message if it exists
    if (streamingMessage) {
      console.log('Updating streaming message element');
      streamingMessage.innerHTML = formattedContent;
    } else {
      console.log('Streaming message element not found, creating it');
      // Try to recreate it if it doesn't exist
      const newStreamingMessage = document.createElement('div');
      newStreamingMessage.className = 'chat-message assistant streaming';
      newStreamingMessage.id = 'streaming-message';
      newStreamingMessage.innerHTML = formattedContent;
      chatMessages.appendChild(newStreamingMessage);
      console.log('Created new streaming message element');
    }
    
    // Update loading content if it exists
    if (loadingContent) {
      console.log('Updating loading content element');
      loadingContent.innerHTML = formattedContent;
      
      // Make sure the loading indicator is visible
      const loadingIndicator = document.getElementById('loading-indicator');
      if (loadingIndicator) {
        // Make sure it's visible
        loadingIndicator.style.display = 'flex';
        // Always make sure it's showing the content by removing collapsed state
        loadingIndicator.classList.remove('collapsed');
      }
    } else {
      console.log('Loading content element not found, creating loading indicator');
      // If loadingContent doesn't exist but should, create the loading indicator
      showLoading(true);
    }
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
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
    console.log('Received message from extension:', message.type, message);
    
    // Check if elements are initialized
    if (!modelSelect) {
      console.error('Elements not initialized when handling message:', message.type);
      // Try to initialize elements if they haven't been initialized yet
      initializeElements();
    }
    
    switch (message.type) {
      case 'updateModelInfo':
        // Populate model selection dropdown
        console.log('Received models:', message.models);
        console.log('Selected model:', message.selectedModel);
        
        // Check if modelSelect exists
        if (!modelSelect) {
          console.error('Model select element not found!');
          const foundModelSelect = document.getElementById('model-select');
          console.log('Attempted to find model-select again:', foundModelSelect);
        } else {
          console.log('Model select element found:', modelSelect);
        }
        
        modelSelect.innerHTML = '';
        
        // Check if models array exists and has items
        if (!message.models || !Array.isArray(message.models) || message.models.length === 0) {
          console.error('No models received or invalid format!', message.models);
          
          // Add a placeholder option
          const placeholderOption = document.createElement('option');
          placeholderOption.textContent = 'No models available';
          placeholderOption.disabled = true;
          placeholderOption.selected = true;
          modelSelect.appendChild(placeholderOption);
        } else {
          // Models array exists, try to add options
          try {
            message.models.forEach((model, index) => {
              console.log(`Adding model ${index}:`, model);
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
            
            // Log the HTML content after population
            console.log('Model select HTML after population:', modelSelect.innerHTML);
            console.log('Number of options added:', modelSelect.options.length);
          } catch (error) {
            console.error('Error populating model dropdown:', error);
          }
        }
        break;
        
      case 'addMessage':
        addMessageToUI(message.role, message.content);
        break;
        
      case 'streamContent':
        console.log('Received streamContent message with content length:', message.content ? message.content.length : 0);
        if (message.content) {
          updateStreamingMessage(message.content);
        } else {
          console.error('Received empty content in streamContent message');
        }
        break;
        
      case 'streamComplete':
        console.log('Received streamComplete message');
        // When streaming is complete, convert the streaming message to a regular message
        const streamingMessageComplete = document.getElementById('streaming-message');
        if (streamingMessageComplete) {
          console.log('Found streaming message element, converting to regular message');
          streamingMessageComplete.id = '';
          streamingMessageComplete.classList.remove('streaming');
        } else {
          console.error('Streaming message element not found on streamComplete');
        }
        
        // Also remove the loading indicator
        const loadingIndicatorComplete = document.getElementById('loading-indicator');
        if (loadingIndicatorComplete) {
          console.log('Removing loading indicator on streamComplete');
          loadingIndicatorComplete.remove();
        }
        
        updateState();
        break;
        
      case 'generationCancelled':
        // Handle when generation is cancelled by user
        console.log('Received generationCancelled message');
        const cancelledMessage = document.createElement('div');
        cancelledMessage.className = 'cancelled-message';
        cancelledMessage.textContent = '--- Generation cancelled by user ---';
        chatMessages.appendChild(cancelledMessage);
        
        // Remove the loading indicator if it exists
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
          console.log('Removing loading indicator on generationCancelled');
          loadingIndicator.remove();
        } else {
          console.log('No loading indicator found to remove on generationCancelled');
        }
        
        // Keep the streaming message but mark it as cancelled
        const streamingMessageCancelled = document.getElementById('streaming-message');
        if (streamingMessageCancelled) {
          console.log('Marking streaming message as cancelled');
          streamingMessageCancelled.classList.add('cancelled');
          streamingMessageCancelled.id = ''; // Remove the id so it's not affected by future updates
        } else {
          console.log('No streaming message found to mark as cancelled');
        }
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
        updateState();
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
        console.log('Received setLoading message:', message.loading);
        showLoading(message.loading);
        break;
        
      case 'showError':
        showError(message.message);
        break;
        
      case 'clearChat':
        // Clear chat messages
        if (chatMessages) {
          chatMessages.innerHTML = '';
        }
        // Clear input
        if (messageInput) {
          messageInput.value = '';
        }
        // Clear context files
        if (contextFilesList) {
          contextFilesList.innerHTML = '';
        }
        // Reset workspace checkbox
        if (useWorkspaceCheckbox) {
          useWorkspaceCheckbox.checked = false;
        }
        break;
    }
  });
  
  // Add a message to the UI
  function addMessageToUI(role, content) {
    // Remove any existing loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
    
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
})(); 