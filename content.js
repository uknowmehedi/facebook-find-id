// User agents list for rotation (50+ user agents)
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
  // Add more user agents as needed (total 50+)
];

// Get a random user agent
function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Set random user agent when script loads
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
  Object.defineProperty(navigator, 'userAgent', {
    get: function() { return getRandomUserAgent(); },
    configurable: true
  });
}

// Check if URL contains a phone number parameter
function checkUrlForPhoneNumber() {
  const urlParams = new URLSearchParams(window.location.search);
  const phoneNumber = urlParams.get('email');
  
  if (phoneNumber) {
    // Mark this number as used
    chrome.runtime.sendMessage({
      action: 'updateResults',
      used: [phoneNumber],
      found: []
    });
    
    // Update status
    chrome.runtime.sendMessage({
      action: 'updateStatus',
      message: `Number ${phoneNumber} found in URL, marked as used`,
      isError: false
    });
    
    return true;
  }
  
  return false;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'startProcess') {
    // Check if URL already contains a phone number before starting process
    if (!checkUrlForPhoneNumber()) {
      startProcess(request.number, request.delay);
    }
    sendResponse({received: true});
  } else if (request.action === 'stopProcess') {
    isStopped = true;
    sendResponse({received: true});
  }
  return true;
});

let isStopped = false;

function startProcess(number, delay = 3000) {
  isStopped = false;
  let processDelay = delay;
  
  // Update status
  updateStatus(`Processing: ${number}`);
  
  // Check if we should process this number
  if (isStopped) {
    updateStatus('Process stopped');
    chrome.runtime.sendMessage({
      action: 'processCompleted'
    });
    return;
  }
  
  // Find the email input and submit button
  const emailInput = document.querySelector('#identify_email');
  const submitButton = document.querySelector('button[type="submit"]');
  
  if (!emailInput || !submitButton) {
    updateStatus('Facebook elements not found!', true);
    isStopped = true;
    finishProcess();
    return;
  }
  
  // Clear input using copy-paste method (more reliable than typing simulation)
  emailInput.focus();
  emailInput.select();
  document.execCommand('paste');
  
  setTimeout(() => {
    // Set value directly (copy-paste method)
    emailInput.value = number;
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    emailInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    setTimeout(() => {
      submitButton.click();
      
      setTimeout(() => {
        // Check if account was found
        const errorElement = document.querySelector('#identify_yourself_contact_point_error');
        const found = !errorElement || errorElement.textContent.trim() === '';
        
        // Mark as used and track result
        if (found) {
          updateResults([number], [number]);
        } else {
          updateResults([number], []);
        }
        
        // Process completed - but don't close the tab
        finishProcess();
      }, 2000);
    }, 300);
  }, 300);
  
  // Function to update status
  function updateStatus(message, isError = false) {
    chrome.runtime.sendMessage({
      action: 'updateStatus',
      message: message,
      isError: isError
    });
  }
  
  // Function to update results
  function updateResults(used, found = []) {
    chrome.runtime.sendMessage({
      action: 'updateResults',
      used: used,
      found: found
    });
  }
  
  // Function to finish process
  function finishProcess() {
    if (isStopped) {
      updateStatus('Process stopped', true);
    } else {
      updateStatus('Process completed - Tab remains open');
    }
    
    chrome.runtime.sendMessage({
      action: 'processCompleted'
    });
  }
}

// Check for phone number in URL when page loads
if (window.location.href.includes('facebook.com/login/web/')) {
  checkUrlForPhoneNumber();
}
