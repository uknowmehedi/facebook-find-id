// Background service worker for managing tabs and processes

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // You can add background processing logic here if needed
  return true;
});

// Track active processes
let activeProcesses = {};

// Function to stop all processes
function stopAllProcesses() {
  Object.keys(activeProcesses).forEach(tabId => {
    chrome.tabs.sendMessage(parseInt(tabId), {
      action: 'stopProcess'
    });
  });
  activeProcesses = {};
}

// Listen for extension installation or update
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    // Initialize storage with default values
    chrome.storage.local.set({
      fbNumbers: [],
      fbUsed: [],
      settings: {
        delay: 3000,
        maxTabs: 5
      }
    });
  }
});

// Listen for stop all command from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'stopAllProcesses') {
    stopAllProcesses();
    sendResponse({stopped: true});
  }
});
