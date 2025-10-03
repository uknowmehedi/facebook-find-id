// Listen for messages from popup and background
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'startProcess') {
    startProcess(request.numbers, request.tabIndex, request.delayTime);
    sendResponse({received: true});
  } else if (request.action === 'stopProcess') {
    isStopped = true;
    sendResponse({received: true});
  } else if (request.action === 'updateUsedNumbers') {
    updateUsedNumbers(request.usedNumbers);
    sendResponse({received: true});
  }
  return true;
});

let isStopped = false;
let currentNumbers = [];
let usedNumbers = [];
let tabIndex = 0;
let delayTime = 2500;

// Update used numbers list every 500ms from background
setInterval(() => {
  chrome.runtime.sendMessage({
    action: 'getUsedNumbers'
  }, function(response) {
    if (response && response.usedNumbers) {
      usedNumbers = response.usedNumbers;
    }
  });
}, 500);

function startProcess(numbers, index, delay) {
  currentNumbers = [...numbers]; // Create a copy
  tabIndex = index || 0;
  isStopped = false;
  delayTime = delay || 2500;
  
  // Add 1-second delay between tabs
  const tabDelay = tabIndex * 1000;
  
  setTimeout(() => {
    // Start processing
    processNext();
  }, tabDelay);
}

// Update used numbers list
function updateUsedNumbers(newUsedNumbers) {
  usedNumbers = newUsedNumbers;
}

// Function to process next number
function processNext() {
  if (isStopped || currentNumbers.length === 0) {
    finishProcess();
    return;
  }
  
  // Filter out used numbers from current numbers
  const availableNumbers = currentNumbers.filter(num => !usedNumbers.includes(num));
  
  if (availableNumbers.length === 0) {
    finishProcess();
    return;
  }
  
  // Get a random number from the available list
  const randomIndex = Math.floor(Math.random() * availableNumbers.length);
  const currentNumber = availableNumbers[randomIndex];
  
  // Remove the number from the local list
  const numberIndex = currentNumbers.indexOf(currentNumber);
  if (numberIndex > -1) {
    currentNumbers.splice(numberIndex, 1);
  }
  
  updateStatus(`Tab ${tabIndex + 1}: Checking ${currentNumber}`);
  
  // Check if we're on the correct page
  if (!window.location.href.includes('facebook.com/login/identify')) {
    updateStatus(`Tab ${tabIndex + 1}: Wrong page, redirecting...`);
    window.location.href = 'https://www.facebook.com/login/identify/?ctx=recover';
    setTimeout(() => processNext(), 3000);
    return;
  }
  
  // Find the email input and submit button
  const emailInput = document.querySelector('#identify_email');
  const submitButton = document.querySelector('button[type="submit"]');
  
  if (!emailInput || !submitButton) {
    updateStatus(`Tab ${tabIndex + 1}: Form elements not found, retrying...`);
    setTimeout(() => processNext(), 2000);
    return;
  }
  
  // Clear input and enter number
  emailInput.value = '';
  emailInput.focus();
  document.execCommand('insertText', false, currentNumber);
  
  // Submit form after 2.5 seconds delay
  setTimeout(() => {
    submitButton.click();
    
    // Wait for results (2.5 seconds)
    setTimeout(() => {
      checkResult(currentNumber);
    }, delayTime);
  }, 1000);
}

// Check if we found an ID
function checkResult(number) {
  // Look for success elements
  const userLink = document.querySelector('a[href*="/user/"], a[href*="/profile.php"]');
  const errorMessage = document.querySelector('#error_box');
  
  if (userLink) {
    // Found a user
    const userId = extractUserId(userLink.href);
    updateStatus(`Tab ${tabIndex + 1}: Found ID ${userId} for ${number}`);
    markNumberAsUsed(number, userId);
    
    // Continue with next number
    setTimeout(() => processNext(), 1000);
  } else if (errorMessage && errorMessage.textContent.includes('No search results')) {
    // No user found - mark as used and continue
    updateStatus(`Tab ${tabIndex + 1}: No user found for ${number}`);
    markNumberAsUsed(number, 'not-found');
    
    // Continue with next number
    setTimeout(() => processNext(), 1000);
  } else {
    // Try again after delay
    setTimeout(() => {
      checkResult(number);
    }, 1000);
  }
}

// Extract user ID from URL
function extractUserId(url) {
  const profileRegex = /profile\.php\?id=(\d+)/;
  const userRegex = /\/user\/(\d+)/;
  
  let match = url.match(profileRegex);
  if (match) return match[1];
  
  match = url.match(userRegex);
  if (match) return match[1];
  
  return 'unknown';
}

// Mark number as used
function markNumberAsUsed(number, id) {
  chrome.runtime.sendMessage({
    action: 'updateResults',
    used: [number],
    found: [{number, id}]
  });
  
  // Schedule removal after 5 seconds
  chrome.runtime.sendMessage({
    action: 'scheduleNumberRemoval',
    number: number
  });
}

// Finish the process
function finishProcess() {
  if (isStopped) {
    updateStatus(`Tab ${tabIndex + 1}: Process stopped`);
  } else {
    updateStatus(`Tab ${tabIndex + 1}: Process completed`);
  }
  
  chrome.runtime.sendMessage({
    action: 'processCompleted',
    tabIndex: tabIndex
  });
}

// Update status - Simplified to only show essential info
function updateStatus(message, isError = false) {
  // Only send essential status messages
  const essentialMessages = [
    'Checking',
    'Found ID',
    'No user found',
    'Process completed',
    'Process stopped'
  ];
  
  const shouldSend = essentialMessages.some(keyword => message.includes(keyword));
  
  if (shouldSend) {
    chrome.runtime.sendMessage({
      action: 'updateStatus',
      message: message,
      isError: isError
    });
  }
}
