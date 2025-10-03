document.addEventListener('DOMContentLoaded', function() {
  const input = document.getElementById('fbNumInput');
  const startTabsBtn = document.getElementById('fbStartTabsBtn');
  const tryAllBtn = document.getElementById('fbTryAllBtn');
  const stopBtn = document.getElementById('fbStopBtn');
  const saveAllBtn = document.getElementById('saveAllBtn');
  const removeAllBtn = document.getElementById('removeAllBtn');
  const reloadTabsBtn = document.getElementById('reloadTabsBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const tabCountInput = document.getElementById('tabCount');
  const delayTimeInput = document.getElementById('delayTime');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const status = document.getElementById('fbStatus');
  const totalCount = document.getElementById('totalCount');
  const usedCount = document.getElementById('usedCount');
  const messageBox = document.getElementById('messageBox');
  const closeBtn = document.getElementById('closeBtn');
  const noticeContent = document.getElementById('noticeContent');
  
  let numbers = [];
  let usedNumbers = [];
  let settings = {
    tabCount: 5,
    delayTime: 2500
  };
  
  let removalTimeouts = new Map();
  let messageHistory = new Set(); // Track messages to avoid duplicates
  
  // Load notice board from Google Docs
  loadNoticeBoard();
  
  // Close popup when close button is clicked
  closeBtn.addEventListener('click', function() {
    window.close();
  });
  
  // Load saved data
  chrome.storage.local.get(['fbNumbers', 'fbUsed', 'fbSettings'], function(data) {
    if (data.fbNumbers) {
      numbers = data.fbNumbers;
      input.value = numbers.join('\n');
      updateCount('total', numbers.length);
    }
    
    if (data.fbUsed) {
      usedNumbers = data.fbUsed;
      updateCount('used', usedNumbers.length);
    }
    
    if (data.fbSettings) {
      settings = data.fbSettings;
      tabCountInput.value = settings.tabCount;
      delayTimeInput.value = settings.delayTime;
    }
    
    // Show initial message
    addMessage('Tool loaded successfully. Ready to use.', 'success');
  });
  
  // Load notice board from Google Docs
  function loadNoticeBoard() {
    // Using a CORS proxy to access Google Docs content
    const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
    const targetUrl = 'https://docs.google.com/document/d/1bxQ30msTFpJ3gocuycbFfUnKhtGrTKTYgf2fXfDz0YY/export?format=txt';
    
    fetch(proxyUrl + targetUrl)
      .then(response => response.text())
      .then(text => {
        noticeContent.textContent = text.substring(0, 200) + '...'; // Limit length
      })
      .catch(error => {
        noticeContent.textContent = 'Unable to load notice board. Please check your connection.';
        console.error('Error loading notice board:', error);
      });
  }
  
  // Get numbers from input
  function getNumbers() {
    const text = input.value.trim();
    return text.split(/[\n,]+/).map(num => num.trim()).filter(num => num);
  }
  
  // Update counts
  function updateCounts() {
    const numbers = getNumbers();
    
    chrome.storage.local.get(['fbUsed'], function(data) {
      const usedNumbers = data.fbUsed || [];
      
      totalCount.textContent = numbers.length;
      usedCount.textContent = usedNumbers.length;
    });
  }
  
  // Toggle settings panel
  settingsBtn.addEventListener('click', function() {
    if (settingsPanel.style.display === 'block') {
      settingsPanel.style.display = 'none';
    } else {
      settingsPanel.style.display = 'block';
    }
  });
  
  // Save settings
  saveSettingsBtn.addEventListener('click', function() {
    settings.tabCount = parseInt(tabCountInput.value) || 5;
    settings.delayTime = parseInt(delayTimeInput.value) || 2500;
    
    chrome.storage.local.set({fbSettings: settings}, function() {
      addMessage('Settings saved successfully', 'success');
      settingsPanel.style.display = 'none';
    });
  });
  
  // Reload all tabs
  reloadTabsBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({
      action: 'reloadAllTabs'
    });
    addMessage('Reloading all tabs', 'info');
  });
  
  // Add double click listener to remove single numbers
  input.addEventListener('dblclick', function(e) {
    const text = input.value;
    const cursorPosition = input.selectionStart;
    const textBefore = text.substring(0, cursorPosition);
    const textAfter = text.substring(cursorPosition);
    
    // Find the line where the cursor is
    const linesBefore = textBefore.split('\n');
    const currentLineIndex = linesBefore.length - 1;
    const lines = text.split('\n');
    
    if (currentLineIndex >= 0 && currentLineIndex < lines.length) {
      const numberToRemove = lines[currentLineIndex].trim();
      
      if (numberToRemove) {
        // Remove from UI
        lines.splice(currentLineIndex, 1);
        input.value = lines.join('\n');
        
        // Remove from storage
        chrome.runtime.sendMessage({
          action: 'removeNumberFromList',
          number: numberToRemove
        });
        
        addMessage(`Removed number: ${numberToRemove}`, 'info');
        updateCounts();
      }
    }
  });
  
  // Schedule number removal after 5 seconds
  function scheduleNumberRemoval(number) {
    // Clear any existing timeout for this number
    if (removalTimeouts.has(number)) {
      clearTimeout(removalTimeouts.get(number));
    }
    
    // Set new timeout to remove after 5 seconds
    const timeoutId = setTimeout(() => {
      removeNumberImmediately(number);
      removalTimeouts.delete(number);
    }, 5000);
    
    removalTimeouts.set(number, timeoutId);
  }
  
  // Remove number immediately
  function removeNumberImmediately(number) {
    // Remove from UI
    const currentNumbers = getNumbers();
    const newNumbers = currentNumbers.filter(num => num !== number);
    input.value = newNumbers.join('\n');
    
    // Remove from storage
    chrome.runtime.sendMessage({
      action: 'removeNumberFromList',
      number: number
    });
    
    addMessage(`Removed number: ${number}`, 'info');
    updateCounts();
  }
  
  // Update counter display
  function updateCount(type, count) {
    if (type === 'total') {
      totalCount.textContent = count;
    } else if (type === 'used') {
      usedCount.textContent = count;
    }
  }
  
  // Add message to message box (with duplicate prevention)
  function addMessage(message, type = 'info') {
    // Create a unique identifier for this message
    const messageId = `${message}-${type}`;
    
    // Check if this message was already shown
    if (messageHistory.has(messageId)) {
      return; // Skip duplicate message
    }
    
    // Add to history
    messageHistory.add(messageId);
    
    // Ensure message box is visible
    messageBox.style.display = 'block';
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    messageBox.appendChild(messageElement);
    messageBox.scrollTop = messageBox.scrollHeight;
    
    // Clean up old messages from history (keep last 100)
    if (messageHistory.size > 100) {
      const oldestMessage = Array.from(messageHistory)[0];
      messageHistory.delete(oldestMessage);
    }
  }
  
  // Save all numbers
  saveAllBtn.addEventListener('click', function() {
    const inputNumbers = getNumbers();
    
    if (inputNumbers.length === 0) {
      status.textContent = 'No valid numbers to save!';
      status.style.color = '#e74c3c';
      addMessage('No valid numbers to save', 'error');
      return;
    }
    
    // Filter out already used numbers
    const newNumbers = inputNumbers.filter(num => !usedNumbers.includes(num));
    
    if (newNumbers.length === 0) {
      status.textContent = 'All these numbers are already used!';
      status.style.color = '#e74c3c';
      addMessage('All numbers are already used', 'warning');
      return;
    }
    
    // Merge with existing numbers and remove duplicates
    numbers = [...new Set([...numbers, ...newNumbers])];
    input.value = numbers.join('\n');
    
    // Save to Chrome storage
    chrome.storage.local.set({ 
      fbNumbers: numbers 
    }, function() {
      updateCount('total', numbers.length);
      status.textContent = `Saved ${newNumbers.length} new numbers!`;
      status.style.color = '#7f8c8d';
      addMessage(`Saved ${newNumbers.length} numbers to storage`, 'success');
      updateCounts();
    });
  });
  
  // Remove all numbers
  removeAllBtn.addEventListener('click', function() {
    numbers = [];
    usedNumbers = [];
    
    // Clear all timeouts
    removalTimeouts.forEach((timeoutId, number) => {
      clearTimeout(timeoutId);
    });
    removalTimeouts.clear();
    
    chrome.storage.local.set({
      fbNumbers: [],
      fbUsed: []
    }, function() {
      input.value = '';
      updateCount('total', 0);
      updateCount('used', 0);
      status.textContent = 'All data removed!';
      status.style.color = '#7f8c8d';
      addMessage('All numbers removed from storage', 'info');
    });
  });
  
  // Start tabs button
  startTabsBtn.addEventListener('click', function() {
    const tabCount = settings.tabCount;
    
    chrome.runtime.sendMessage({
      action: 'startTabs',
      tabCount: tabCount
    });
    
    status.textContent = `Opening ${tabCount} tabs...`;
    status.style.color = '#7f8c8d';
    addMessage(`Opening ${tabCount} tabs for processing`, 'info');
  });
  
  // Try All button
  tryAllBtn.addEventListener('click', function() {
    const inputNumbers = getNumbers();
    
    if (inputNumbers.length === 0) {
      status.textContent = 'No numbers to check!';
      status.style.color = '#e74c3c';
      addMessage('No numbers to check', 'error');
      return;
    }
    
    // Filter out already used numbers
    const unusedNumbers = inputNumbers.filter(num => !usedNumbers.includes(num));
    
    if (unusedNumbers.length === 0) {
      status.textContent = 'All numbers have been used!';
      status.style.color = '#e74c3c';
      addMessage('All numbers have been used', 'warning');
      return;
    }
    
    // Start multi-tab process
    chrome.runtime.sendMessage({
      action: 'startProcess',
      numbers: unusedNumbers
    });
    
    status.textContent = `Starting process with ${unusedNumbers.length} numbers...`;
    status.style.color = '#7f8c8d';
    addMessage(`Starting process with ${unusedNumbers.length} numbers`, 'info');
  });
  
  // Stop button
  stopBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({
      action: 'stopProcess'
    });
    status.textContent = 'Stopping all processes...';
    status.style.color = '#e74c3c';
    addMessage('Stopping all processes', 'warning');
  });
  
  // Listen for messages from content script and background
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateStatus') {
      // Filter out non-essential messages
      const essentialMessages = [
        'Opening',
        'Checking',
        'Found ID',
        'No user found',
        'Process completed',
        'Process stopped',
        'Reloading',
        'Saved',
        'Removed',
        'Starting process'
      ];
      
      const shouldShow = essentialMessages.some(keyword => request.message.includes(keyword));
      
      if (shouldShow) {
        status.textContent = request.message;
        if (request.isError) {
          status.style.color = '#e74c3c';
          addMessage(request.message, 'error');
        } else {
          status.style.color = '#7f8c8d';
          addMessage(request.message, 'info');
        }
      }
    } else if (request.action === 'updateResults') {
      // Update used numbers
      usedNumbers = [...usedNumbers, ...request.used];
      
      // Save to storage
      chrome.storage.local.set({
        fbUsed: usedNumbers
      }, function() {
        updateCount('used', usedNumbers.length);
        
        // Schedule removal of used numbers after 5 seconds
        request.used.forEach(number => {
          scheduleNumberRemoval(number);
        });
        
        // Remove used numbers from main list
        numbers = numbers.filter(num => !request.used.includes(num));
        chrome.storage.local.set({
          fbNumbers: numbers
        }, function() {
          input.value = numbers.join('\n');
          updateCount('total', numbers.length);
        });
      });
    } else if (request.action === 'processCompleted') {
      status.textContent = 'Process completed!';
      status.style.color = '#7f8c8d';
      addMessage('Process completed', 'success');
    } else if (request.action === 'numbersListUpdated') {
      // Update numbers list from storage
      numbers = request.numbers;
      input.value = numbers.join('\n');
      updateCount('total', numbers.length);
    } else if (request.action === 'usedCountUpdated') {
      // Update used count from background
      usedCount.textContent = request.count;
      chrome.storage.local.get(['fbUsed'], function(data) {
        if (data.fbUsed) {
          usedNumbers = data.fbUsed;
        }
      });
    } else if (request.action === 'scheduleNumberRemoval') {
      scheduleNumberRemoval(request.number);
    }
  });
  
  // Initialize the message box
  messageBox.style.display = 'block';
});
