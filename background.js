// Background script for multi-tab management
let activeTabs = new Map();
let settings = {
  tabCount: 5,
  delayTime: 2500
};

// Load settings
chrome.storage.local.get(['fbSettings'], function(data) {
  if (data.fbSettings) {
    settings = {...settings, ...data.fbSettings};
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'startTabs') {
    startTabs(request.tabCount);
    sendResponse({received: true});
  } else if (request.action === 'startProcess') {
    startProcess(request.numbers);
    sendResponse({received: true});
  } else if (request.action === 'stopProcess') {
    stopAllProcesses();
    sendResponse({received: true});
  } else if (request.action === 'updateStatus') {
    chrome.runtime.sendMessage(request);
  } else if (request.action === 'updateResults') {
    updateUsedNumbers(request.used, request.found);
    chrome.runtime.sendMessage(request);
  } else if (request.action === 'getUsedNumbers') {
    chrome.storage.local.get(['fbUsed'], function(data) {
      sendResponse({usedNumbers: data.fbUsed || []});
    });
    return true;
  } else if (request.action === 'removeNumberFromList') {
    removeNumberFromList(request.number);
    sendResponse({received: true});
  } else if (request.action === 'getSettings') {
    sendResponse({settings: settings});
  } else if (request.action === 'saveSettings') {
    settings = request.settings;
    chrome.storage.local.set({fbSettings: settings}, function() {
      sendResponse({saved: true});
    });
    return true;
  } else if (request.action === 'closeTab') {
    if (sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id);
    }
    sendResponse({received: true});
  } else if (request.action === 'reloadAllTabs') {
    reloadAllTabs();
    sendResponse({received: true});
  } else if (request.action === 'scheduleNumberRemoval') {
    scheduleNumberRemoval(request.number);
    sendResponse({received: true});
  }
  return true;
});

// Start tabs only
function startTabs(tabCount) {
  activeTabs.clear();
  
  for (let i = 0; i < tabCount; i++) {
    chrome.tabs.create({
      url: 'https://www.facebook.com/login/identify/?ctx=recover',
      active: false
    }, function(tab) {
      activeTabs.set(tab.id, {
        status: 'ready',
        index: i
      });
    });
  }
}

// Start process in multiple tabs
function startProcess(numbers) {
  chrome.storage.local.get(['fbUsed'], function(data) {
    const usedNumbers = data.fbUsed || [];
    const unusedNumbers = numbers.filter(num => !usedNumbers.includes(num));
    
    if (unusedNumbers.length === 0) {
      chrome.runtime.sendMessage({
        action: 'updateStatus',
        message: 'All numbers have been used!',
        isError: true
      });
      return;
    }
    
    // Send essential message about starting process
    chrome.runtime.sendMessage({
      action: 'updateStatus',
      message: `Starting process with ${unusedNumbers.length} numbers`
    });
    
    // Send numbers to each tab with delay
    let delay = 0;
    activeTabs.forEach((tabData, tabId) => {
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, {
          action: 'startProcess',
          numbers: unusedNumbers,
          tabIndex: tabData.index,
          delayTime: settings.delayTime
        });
      }, delay);
      delay += 1000; // 1 second delay between tabs
    });
  });
}

// Update used numbers in storage
function updateUsedNumbers(used, found) {
  chrome.storage.local.get(['fbUsed'], function(data) {
    const currentUsed = data.fbUsed || [];
    
    const newUsed = [...new Set([...currentUsed, ...used])];
    
    chrome.storage.local.set({
      fbUsed: newUsed
    }, function() {
      removeUsedNumbersFromList(newUsed);
      
      chrome.runtime.sendMessage({
        action: 'usedCountUpdated',
        count: newUsed.length
      });
      
      // Update all tabs with the new used numbers list
      updateAllTabsWithUsedNumbers(newUsed);
    });
  });
}

// Update all tabs with the latest used numbers
function updateAllTabsWithUsedNumbers(usedNumbers) {
  activeTabs.forEach((tabData, tabId) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        action: 'updateUsedNumbers',
        usedNumbers: usedNumbers
      },
      (response) => {
        // Handle errors gracefully
        if (chrome.runtime.lastError) {
          // Tab might be closed or content script not loaded
        }
      }
    );
  });
}

// Remove used numbers from the main numbers list
function removeUsedNumbersFromList(usedNumbers) {
  chrome.storage.local.get(['fbNumbers'], function(data) {
    const currentNumbers = data.fbNumbers || [];
    const newNumbers = currentNumbers.filter(num => !usedNumbers.includes(num));
    
    if (newNumbers.length !== currentNumbers.length) {
      chrome.storage.local.set({fbNumbers: newNumbers}, function() {
        chrome.runtime.sendMessage({
          action: 'numbersListUpdated',
          numbers: newNumbers
        });
      });
    }
  });
}

// Remove a single number from the main numbers list
function removeNumberFromList(number) {
  chrome.storage.local.get(['fbNumbers'], function(data) {
    const currentNumbers = data.fbNumbers || [];
    const newNumbers = currentNumbers.filter(num => num !== number);
    
    if (newNumbers.length !== currentNumbers.length) {
      chrome.storage.local.set({fbNumbers: newNumbers}, function() {
        chrome.runtime.sendMessage({
          action: 'numbersListUpdated',
          numbers: newNumbers
        });
      });
    }
  });
}

// Schedule number removal after 5 seconds
function scheduleNumberRemoval(number) {
  setTimeout(() => {
    removeNumberFromList(number);
  }, 5000);
}

// Reload all tabs
function reloadAllTabs() {
  activeTabs.forEach((tabData, tabId) => {
    // Check if tab still exists before trying to reload
    chrome.tabs.get(tabId, function(tab) {
      if (!chrome.runtime.lastError) {
        chrome.tabs.reload(tabId);
      }
    });
  });
}

// Stop all processes
function stopAllProcesses() {
  const promises = [];
  
  activeTabs.forEach((tabData, tabId) => {
    // Create a promise for each message send
    const promise = new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tabId, 
        { action: 'stopProcess' },
        (response) => {
          // Handle errors gracefully - tab might be closed or content script not loaded
          if (chrome.runtime.lastError) {
            console.log('Tab not responding:', tabId, chrome.runtime.lastError);
          }
          resolve();
        }
      );
    });
    promises.push(promise);
  });
  
  // Wait for all messages to be sent before clearing
  Promise.all(promises).then(() => {
    activeTabs.clear();
  });
}

// Track tab removal
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  if (activeTabs.has(tabId)) {
    activeTabs.delete(tabId);
  }
});
