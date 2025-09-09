document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const input = document.getElementById('fbNumInput');
  const startBtn = document.getElementById('fbStartBtn');
  const stopAllBtn = document.getElementById('stopAllBtn');
  const closeToolBtn = document.getElementById('closeToolBtn');
  const saveAllBtn = document.getElementById('saveAllBtn');
  const removeAllBtn = document.getElementById('removeAllBtn');
  const importBtn = document.getElementById('importBtn');
  const status = document.getElementById('fbStatus');
  const totalCount = document.getElementById('totalCount');
  const usedCount = document.getElementById('usedCount');
  const importFile = document.getElementById('importFile');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const delayInput = document.getElementById('delayInput');
  const maxTabsInput = document.getElementById('maxTabs');
  const maxTabsDisplay = document.getElementById('maxTabsDisplay');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const noticeBoard = document.getElementById('noticeBoard');
  const noticeContent = document.querySelector('.notice-content');
  const activeTabCount = document.getElementById('activeTabCount');
  const settingsStatus = document.getElementById('settingsStatus');

  // Global variables
  let numbers = [];
  let usedNumbers = [];
  let isStopped = false;
  let activeTabs = {};
  let settings = {
    delay: 3000,
    maxTabs: 5
  };
  let lastClickTime = 0;
  let lastClickedNumber = '';

  // Load notice from Google Docs
  function loadNotice() {
    const docsUrl = 'https://docs.google.com/document/d/1bxQ30msTFpJ3gocuycbFfUnKhtGrTKTYgf2fXfDz0YY/export?format=txt';
    
    fetch(docsUrl)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.text();
      })
      .then(text => {
        const cleanText = text.trim();
        if (cleanText && cleanText !== '.' && cleanText.length > 3) {
          noticeContent.textContent = cleanText;
          noticeBoard.style.display = 'block';
        } else {
          noticeBoard.style.display = 'none';
        }
      })
      .catch(error => {
        console.error('Error loading notice:', error);
        noticeBoard.style.display = 'none';
      });
  }

  // Update active tab count display
  function updateActiveTabCount() {
    activeTabCount.textContent = Object.keys(activeTabs).length;
  }

  // Tab functionality
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      
      // Update active tab button
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Show active tab content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${tabId}-tab`) {
          content.classList.add('active');
        }
      });
    });
  });

  // Load saved data
  chrome.storage.local.get(['fbNumbers', 'fbUsed', 'settings'], function(data) {
    if (data.fbNumbers) {
      numbers = data.fbNumbers;
      input.value = numbers.join('\n');
      updateCount('total', numbers.length);
    }
    
    if (data.fbUsed) {
      usedNumbers = data.fbUsed;
      updateCount('used', usedNumbers.length);
    }
    
    if (data.settings) {
      settings = data.settings;
      delayInput.value = settings.delay;
      maxTabsInput.value = settings.maxTabs;
      maxTabsDisplay.textContent = settings.maxTabs;
    }
  });

  // Update counter display
  function updateCount(type, count) {
    switch(type) {
      case 'total':
        totalCount.textContent = count;
        break;
      case 'used':
        usedCount.textContent = count;
        break;
    }
  }

  // Double-click handler for removing numbers
  input.addEventListener('dblclick', function(e) {
    const cursorPosition = e.target.selectionStart;
    const text = e.target.value;
    const lines = text.split('\n');
    
    let lineStart = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineEnd = lineStart + lines[i].length;
      
      if (cursorPosition >= lineStart && cursorPosition <= lineEnd) {
        // Found the line that was double-clicked
        const numberToRemove = lines[i].trim();
        
        if (numberToRemove) {
          // Remove the number from the array
          numbers = numbers.filter(num => num !== numberToRemove);
          
          // Update the textarea
          e.target.value = numbers.join('\n');
          
          // Save to storage
          chrome.storage.local.set({ fbNumbers: numbers }, function() {
            updateCount('total', numbers.length);
            status.textContent = `Removed number: ${numberToRemove}`;
            status.style.color = '#7f8c8d';
          });
        }
        break;
      }
      
      lineStart = lineEnd + 1; // +1 for the newline character
    }
  });

  // Save all numbers
  saveAllBtn.addEventListener('click', function() {
    const inputNumbers = input.value.split(/\n|,/).map(n => n.trim()).filter(n => n.length > 0);
    
    if (inputNumbers.length === 0) {
      status.textContent = 'No valid numbers to save!';
      status.style.color = '#e74c3c';
      return;
    }
    
    numbers = [...new Set([...numbers, ...inputNumbers])]; // Remove duplicates
    input.value = numbers.join('\n');
    
    // Remove used numbers from the list
    numbers = numbers.filter(num => !usedNumbers.includes(num));
    input.value = numbers.join('\n');
    
    chrome.storage.local.set({ fbNumbers: numbers }, function() {
      updateCount('total', numbers.length);
      status.textContent = `Saved ${inputNumbers.length} numbers!`;
      status.style.color = '#7f8c8d';
    });
  });

  // Remove all numbers
  removeAllBtn.addEventListener('click', function() {
    numbers = [];
    usedNumbers = [];
    
    chrome.storage.local.set({
      fbNumbers: [],
      fbUsed: []
    }, function() {
      input.value = '';
      updateCount('total', 0);
      updateCount('used', 0);
      status.textContent = 'All data removed!';
      status.style.color = '#7f8c8d';
    });
  });

  // Import numbers
  importBtn.addEventListener('click', function() {
    importFile.click();
  });

  importFile.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
      const content = e.target.result;
      const importedNumbers = content.split(/\n|,/).map(n => n.trim()).filter(n => n.length > 0);
      
      if (importedNumbers.length === 0) {
        status.textContent = 'No valid numbers in file!';
        status.style.color = '#e74c3c';
        return;
      }
      
      numbers = [...new Set([...numbers, ...importedNumbers])];
      // Remove used numbers from the list
      numbers = numbers.filter(num => !usedNumbers.includes(num));
      input.value = numbers.join('\n');
      
      chrome.storage.local.set({ fbNumbers: numbers }, function() {
        updateCount('total', numbers.length);
        status.textContent = `Imported ${importedNumbers.length} numbers!`;
        status.style.color = '#7f8c8d';
      });
    };
    reader.readAsText(file);
  });

  // Save settings
  saveSettingsBtn.addEventListener('click', function() {
    settings.delay = parseInt(delayInput.value) || 3000;
    settings.maxTabs = parseInt(maxTabsInput.value) || 5;
    
    if (settings.maxTabs < 1) settings.maxTabs = 1;
    if (settings.maxTabs > 5) settings.maxTabs = 5;
    
    chrome.storage.local.set({ settings: settings }, function() {
      maxTabsDisplay.textContent = settings.maxTabs;
      
      // Show success message
      settingsStatus.textContent = '✅ Successfully saved!';
      settingsStatus.className = 'status-message success';
      settingsStatus.style.display = 'block';
      
      // Hide message after 3 seconds
      setTimeout(() => {
        settingsStatus.style.display = 'none';
      }, 3000);
    });
  });

  // Close tool button
  closeToolBtn.addEventListener('click', function() {
    window.close();
  });

  // Stop all button
  stopAllBtn.addEventListener('click', function() {
    isStopped = true;
    stopAllProcesses();
    
    status.textContent = 'All processes stopped!';
    status.style.color = '#e74c3c';
  });

  // Function to stop all processes across all tabs
  function stopAllProcesses() {
    // Send stop message to all active tabs
    Object.keys(activeTabs).forEach(tabId => {
      chrome.tabs.sendMessage(parseInt(tabId), {
        action: 'stopProcess'
      });
    });
    
    // Clear active tabs but DON'T close them
    activeTabs = {};
    updateActiveTabCount();
  }

  // Start button
  startBtn.addEventListener('click', function() {
    if (numbers.length === 0) {
      status.textContent = 'No numbers to check!';
      status.style.color = '#e74c3c';
      return;
    }
    
    // Check if maximum tabs are already active
    if (Object.keys(activeTabs).length >= settings.maxTabs) {
      status.textContent = `Maximum ${settings.maxTabs} tabs are already active!`;
      status.style.color = '#e74c3c';
      return;
    }
    
    // Filter out already used numbers
    const unusedNumbers = numbers.filter(num => !usedNumbers.includes(num));
    
    if (unusedNumbers.length === 0) {
      status.textContent = 'All numbers have been used!';
      status.style.color = '#e74c3c';
      return;
    }
    
    isStopped = false;
    
    // Get only one number for this tab
    const numberForTab = unusedNumbers[0];
    
    // Open a single tab with one number
    openFacebookTab(numberForTab, Object.keys(activeTabs).length);
    
    status.textContent = `Starting tab ${Object.keys(activeTabs).length + 1} with number: ${numberForTab}`;
    status.style.color = '#7f8c8d';
  });

  // Function to open Facebook tab and start process
  function openFacebookTab(numberForTab, tabIndex) {
    if (isStopped) return;
    
    chrome.tabs.create({
      url: 'https://www.facebook.com/login/identify/?ctx=recover',
      active: false
    }, function(tab) {
      // Store tab reference
      activeTabs[tab.id] = {
        number: numberForTab,
        index: tabIndex
      };
      
      updateActiveTabCount();
      
      // Wait for tab to load then send message
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(() => {
            if (!isStopped) {
              chrome.tabs.sendMessage(tabId, {
                action: 'startProcess',
                number: numberForTab,
                delay: settings.delay
              });
            }
          }, 1000);
        }
      });
    });
  }

  // Listen for messages from content scripts
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateStatus') {
      status.textContent = `Tab ${activeTabs[sender.tab.id]?.index + 1 || 1}: ${request.message}`;
      if (request.isError) {
        status.style.color = '#e74c3c';
      } else {
        status.style.color = '#7f8c8d';
      }
    } else if (request.action === 'updateResults') {
      // Update used numbers
      usedNumbers = [...usedNumbers, ...request.used];
      
      // Remove used numbers from the main list
      numbers = numbers.filter(num => !usedNumbers.includes(num));
      input.value = numbers.join('\n');
      
      // Save to storage
      chrome.storage.local.set({
        fbNumbers: numbers,
        fbUsed: usedNumbers
      }, function() {
        updateCount('total', numbers.length);
        updateCount('used', usedNumbers.length);
      });
    } else if (request.action === 'processCompleted') {
      // Remove tab from active tabs but DON'T close it
      if (sender.tab && sender.tab.id in activeTabs) {
        delete activeTabs[sender.tab.id];
        updateActiveTabCount();
        
        // DO NOT close the tab - let it remain open
        // chrome.tabs.remove(sender.tab.id);
      }
      
      // Check if all processes are completed
      if (Object.keys(activeTabs).length === 0) {
        status.textContent = 'All processes completed! Tabs remain open.';
        status.style.color = '#7f8c8d';
      }
    }
  });

  // Load notice on startup
  loadNotice();
});
