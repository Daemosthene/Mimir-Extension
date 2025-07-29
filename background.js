const freeTools = ["Summarize", "Explain Like I'm 5", "Translate Text"];
const FREE_LIMIT = 5;

async function checkAccess(toolName) {
  const today = new Date().toISOString().split('T')[0];

  return new Promise((resolve) => {
    chrome.storage.local.get(["usage", "isProUser"], (data) => {
      const { usage = {}, isProUser = false } = data;

      if (isProUser) return resolve(true);

      const dayUsage = usage[today] || {};
      const count = dayUsage[toolName] || 0;

      if (freeTools.includes(toolName) && count < FREE_LIMIT) {
        dayUsage[toolName] = count + 1;
        usage[today] = dayUsage;
        chrome.storage.local.set({ usage }, () => resolve(true));
      } else {
        resolve(false);
      }
    });
  });
}

// background.js additions :contentReference[oaicite:2]{index=2}

async function verifyProStatus() {
  chrome.storage.local.get('checkoutSessionId', async ({ checkoutSessionId }) => {
    if (!checkoutSessionId) return;

    try {
      const res = await fetch(
        `https://mimir-server-daemosthene-mimir-extension.vercel.app/api/verify-subscription?sessionId=${checkoutSessionId}`
      );
      const { status, currentPeriodEnd } = await res.json();
      const isActive = status === 'active';
      
      // Update storage so your UI gates update correctly
      chrome.storage.local.set({ isProUser: isActive });

      if (isActive && currentPeriodEnd) {
        // Schedule a one-time alarm at the end of this billing period
        chrome.alarms.create('renewCheck', {
          when: currentPeriodEnd * 1000
        });
      }
    } catch (err) {
      console.error('Failed to verify subscription:', err);
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "mimir_menu",
    title: "Mimir Tools",
    contexts: ["selection", "page"]
  });

  const features = [
    "Summarize", "Explain Like I'm 5", "Citation Finder", "Definition",
    "Daily Brief", "Socratic Review", "Flashcard Generator",
    "Turn Professional", "Translate Text",
    "Upload Image"
  ];

  features.forEach(feature => {
    chrome.contextMenus.create({
      id: feature,
      parentId: "mimir_menu",
      title: feature,
      contexts: ["selection", "page"]
    });
  });

  chrome.storage.local.get("theme", (data) => {
    const theme = data.theme || "default";
    const ICONS = {
      default: {
        "16": "extensionLogo.png",
        "48": "extensionLogo.png",
        "128": "extensionLogo.png"
      },
      red: {
        "16": "red.png",
        "48": "red.png",
        "128": "red.png"
      },
      orange: {
        "16": "orange.png",
        "48": "orange.png",
        "128": "orange.png"
      },
      darkblue: {
        "16": "darkblue.png",
        "48": "darkblue.png",
        "128": "darkblue.png"
      },
      green: {
        "16": "green.png",
        "48": "green.png",
        "128": "green.png"
      },
      purple: {
        "16": "purple.png",
        "48": "purple.png",
        "128": "purple.png"
      },
      teal: {
        "16": "teal.png",
        "48": "teal.png",
        "128": "teal.png"
      },
      yellow: {
        "16": "yellow.png",
        "48": "yellow.png",
        "128": "yellow.png"
      }
    };

    const iconSet = ICONS[theme] || ICONS.default;

    chrome.action.setIcon({ path: iconSet }, () => {
      if (chrome.runtime.lastError) {
        console.warn("⚠️ Failed to set icon:", chrome.runtime.lastError.message);
      }
    });
  });
});


// Unified right-click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const action = info.menuItemId;
  const selectedText = info.selectionText?.trim();

  if (!tab?.id) return;

  // Special handling for Upload Image only (removed Capture Image)
  if (action === "Upload Image") {
    chrome.tabs.sendMessage(tab.id, {
      type: "open_capture_image"
    });
    return;
  }

  if (selectedText) {
    checkAccess(action).then(allowed => {
      if (!allowed) {
        chrome.tabs.sendMessage(tab.id, {
          type: "open_sidebar_tool",
          action: "Turn Professional",
          text: "🔒 This tool requires a Pro subscription. Click 'Go Pro' in the extension popup to unlock."
        });
        return;
      }

      chrome.tabs.sendMessage(tab.id, {
        type: "open_sidebar_tool",
        action,
        text: selectedText
      });
    });
  } else {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText
    }, (results) => {
      const pageText = results?.[0]?.result || "";

      checkAccess(action).then(allowed => {
        if (!allowed) {
          chrome.tabs.sendMessage(tab.id, {
            type: "open_sidebar_tool",
            action: "Turn Professional",
            text: "🔒 This tool requires a Pro subscription. Click 'Go Pro' in the extension popup to unlock."
          });
          return;
        }

        chrome.tabs.sendMessage(tab.id, {
          type: "open_sidebar_tool",
          action,
          text: pageText
        });
      });
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "proxy_api_request") {
    console.log("🔥 Background: Received proxy API request", message.payload);
    
    // Send the request through the background script
    const { url, method, body } = message.payload || {};
    
    // Validate payload data
    if (!url) {
      console.error("🔥 Background: Invalid proxy API request - missing URL");
      sendResponse({ success: false, error: "Missing URL in proxy request" });
      return true;
    }
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    fetch(url, {
      method: method || 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {}),
      signal: controller.signal
    })
    .then(response => {
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`🔥 Background: Proxy API request failed with status: ${response.status}`);
        throw new Error(`API request failed with status: ${response.status} ${response.statusText}`);
      }
      
      return response.json().catch(err => {
        console.error("🔥 Background: Error parsing JSON response", err);
        throw new Error("Invalid JSON response from API");
      });
    })
    .then(data => {
      console.log("🔥 Background: Proxy API request success", data);
      
      if (!data) {
        sendResponse({ success: false, error: "Empty response from API" });
        return;
      }
      
      sendResponse({ success: true, data });
    })
    .catch(error => {
      clearTimeout(timeoutId);
      
      console.error("🔥 Background: Proxy API request error", error);
      
      // Handle specific error types
      let errorMessage = error.message || "Unknown error occurred";
      
      if (error.name === 'AbortError') {
        errorMessage = "Request timed out after 30 seconds";
      } else if (errorMessage.includes('NetworkError')) {
        errorMessage = "Network error: Please check your internet connection";
      } else if (errorMessage.includes('CORS')) {
        errorMessage = "CORS error: The API server rejected the request";
      }
      
      sendResponse({ 
        success: false, 
        error: errorMessage,
        details: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      });
    });
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
  
  if (message.type === "captureVisibleTab") {
    console.log("🔥 Background: Received captureVisibleTab request");
    
    // Get the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) {
        console.error("🔥 Background: No active tab found");
        sendResponse({ success: false, error: "No active tab found" });
        return;
      }
      
      const tab = tabs[0];
      console.log("🔥 Background: Capturing tab", tab.id);
      
      // Capture the visible tab
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
        console.log("🔥 Background: captureVisibleTab callback executed");
        
        if (chrome.runtime.lastError) {
          console.error('🔥 Background: Capture failed:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        
        if (!dataUrl) {
          console.error('🔥 Background: No dataUrl returned');
          sendResponse({ success: false, error: "No image data captured" });
          return;
        }
        
        console.log("🔥 Background: Capture successful, dataUrl length:", dataUrl.length);
        sendResponse({ success: true, imageData: dataUrl });
      });
    });
    
    return true; // Keep message channel open for async response
  } else if (message.type === "getTabInfo") {
    console.log("🔥 Background: Received getTabInfo request");
    // Get the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) {
        console.error("🔥 Background: No active tab found");
        sendResponse({ success: false, error: "No active tab found" });
        return;
      }

      const tab = tabs[0];
      console.log("🔥 Background: Tab info", tab);
      sendResponse({ success: true, tab });
    });
  }
});