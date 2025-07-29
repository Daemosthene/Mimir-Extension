// content.js

// Prevent duplicate loading of content script
(function() {
  'use strict';
  
  if (window.mimirContentScriptLoaded) {
    console.log("🔥 Content script already loaded, skipping");
    return;
    }
  })();
  
  window.mimirContentScriptLoaded = true;
  console.log("🔥 Content script loading...");

  // Helper function to check if extension context is valid
  function isExtensionContextValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }
  
  // Helper function to check if we're online
  function isOnline() {
    return window.navigator.onLine;
  }
  
  // Helper function for network diagnostics
  function checkConnectivity() {
    return new Promise((resolve) => {
      if (!isOnline()) {
        resolve({
          online: false,
          message: "Device is offline. Please check your internet connection."
        });
        return;
      }
      
      // Try to fetch a known reliable endpoint
      fetch('https://www.google.com/generate_204', { 
        mode: 'no-cors',
        cache: 'no-cache'
      })
      .then(() => {
        resolve({
          online: true,
          message: "Internet connectivity confirmed."
        });
      })
      .catch(error => {
        resolve({
          online: true, // Navigator says online but fetch failed
          reliable: false,
          message: "Unreliable connection detected.",
          error: error.message
        });
      });
    });
  }
  
  // Function to proxy API requests through the background script
  function proxyAPIRequest(url, body, timeoutMs = 30000) {
    console.log(`🔄 Proxying API request to ${url}`);
    return new Promise((resolve, reject) => {
      if (!isExtensionContextValid()) {
        reject(new Error('Extension context is invalid, cannot make API requests'));
        return;
      }
      
      // Set a timeout in case the background script doesn't respond
      const timeoutId = setTimeout(() => {
        reject(new Error(`Proxy API request timed out after ${timeoutMs/1000} seconds`));
      }, timeoutMs);
      
      chrome.runtime.sendMessage({
        type: "proxy_api_request",
        payload: {
          url: url,
          method: 'POST',
          body: body
        }
      }, response => {
        clearTimeout(timeoutId);
        
        // Check for Chrome runtime errors
        if (chrome.runtime.lastError) {
          console.error(`🔄 Chrome runtime error: ${chrome.runtime.lastError.message}`);
          reject(new Error(`Chrome runtime error: ${chrome.runtime.lastError.message}`));
          return;
        }
        
        // Check for missing response
        if (!response) {
          console.error(`🔄 No response from background script`);
          reject(new Error('No response from background script'));
          return;
        }
        
        // Handle API response
        if (response.success && response.data) {
          console.log(`🔄 Proxy API request succeeded`);
          resolve(response.data);
        } else {
          console.error(`🔄 Proxy API request failed: ${response.error || 'Unknown error'}`);
          reject(new Error(response.error || 'Unknown error'));
        }
      });
    });
  }

  // Safe wrapper for chrome.storage operations
  function safeStorageGet(keys, callback) {
    if (!isExtensionContextValid()) {
      console.warn('Extension context invalidated, using defaults');
      callback({});
      return;
    }
    
    try {
      chrome.storage.local.get(keys, callback);
    } catch (error) {
      console.warn('Storage access failed:', error);
      callback({});
    }
  }

  function safeStorageSet(data, callback) {
    if (!isExtensionContextValid()) {
      console.warn('Extension context invalidated, cannot save data');
      if (callback) callback();
      return;
    }
    
    try {
      chrome.storage.local.set(data, callback);
    } catch (error) {
      console.warn('Storage set failed:', error);
      if (callback) callback();
    }
  }

  // Safe wrapper for chrome.runtime.getURL
  function safeGetURL(path) {
    if (!isExtensionContextValid()) {
      return 'data:font/opentype;base64,'; // fallback for font
    }
    
    try {
      return chrome.runtime.getURL(path);
    } catch (error) {
      console.warn('Runtime getURL failed:', error);
      return 'data:font/opentype;base64,';
    }
  }

  function buildRequestBody(toolName, text) {
    const base = { action: toolName, text };

    switch (toolName) {
      case "Summarize":
        return { ...base, mode: "concise", includeKeywords: true };
      case "Explain Like I'm 5":
        return { ...base, simplifyLevel: 5 };
      case "Citation Finder":
        return { ...base, includeLinks: true, format: "APA" };
      case "Definition":
        return { ...base, includeExamples: true, simplify: true };
      case "Daily Brief":
        return { ...base, context: "yesterday", includeTasks: true };
      case "Socratic Review":
        return { ...base, questionStyle: "dialectic", depth: "high" };
      case "Flashcard Generator":
        return { ...base, format: "anki", maxCards: 10 };
      case "Turn Professional":
        return { ...base, tone: "professional", polish: true };
      case "Translate Text":
        return { ...base, targetLanguage: "en", preserveFormat: true };
      default:
        return base;
    }
  }

  let sidebarSide = "right";
  let sidebarWidth = 360;

  function injectStyles() {
    const id = "mimir-drift-style";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .mimir-sidebar {
        position: fixed;
        top: 0;
        height: 100%;
        width: 360px;
        background: #1F1F1F;
        color: #ffffff;
        box-shadow: 0 0 8px #000000;
        display: flex;
        flex-direction: column;
        z-index: 99999;
        transition: transform 0.3s ease;
      }

      .mimir-sidebar.left { left: 0; }
      .mimir-sidebar.right { right: 0; }

      .mimir-close-btn {
        border: none;
        background: none;
        font-size: 16px;
        align-self: flex-end;
        margin: 8px;
        cursor: pointer;
      }

      .mimir-toggle-btn {
        border: none;
        background: none;
        font-size: 16px;
        cursor: pointer;
        margin: 8px auto;
        margin-top: auto;
      }

      .mimir-resizer {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 6px;
        background: #ddd;
        cursor: ew-resize;
        z-index: 100000;
      }

      .mimir-resizer.left { right: 0; }
      .mimir-resizer.right { left: 0; }

      .mimir-tool-button {
        padding: 6px 10px;
        margin: 4px 0;
        border: none;
        background: var(--accent-color);
        color: white;
        cursor: pointer;
        font-size: 14px;
        text-align: left;
        border-radius: 4px;
      }

      .mimir-spinner {
        border: 4px solid #ccc;
        border-top: 4px solid var(--accent-color);
        border-radius: 50%;
        width: 20px;
        height: 20px;
        animation: spin 1s linear infinite;
        margin: 10px auto;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .mimir-sidebar-results {
        padding: 10px;
        font-size: 18px;
        overflow-y: auto;
        white-space: pre-wrap;
      }
      @font-face {
          font-family: 'norse.bold.otf';
          src: url(${safeGetURL("norse.bold.otf")}) format("opentype");
        }
      .mimir-sidebar-title {
        font-family: 'norse.bold.otf', sans-serif;
        font-size: 30px;
        font-weight: normal;
        margin: 0;
        padding: 0;
        color: var(--accent-color);
      }          
    `;
    document.head.appendChild(style);
  }

  function getEditableText() {
    return Array.from(document.querySelectorAll('[contenteditable="true"], textarea'))
      .map(el => el.value || el.innerText || "")
      .filter(text => text.trim())
      .join("\n\n");
  }

function createSidebar(callback) {
  if (document.getElementById("mimir-sidebar")) return;
  
  // Helper function to detect if text is a multiple choice question
  function isMultipleChoiceQuestion(text) {
    // Sanitize text input
    if (!text || typeof text !== 'string') {
      console.warn("🔄 Invalid text input for isMultipleChoiceQuestion:", text);
      return false;
    }
    
    // Quick check for common MCQ indicators to avoid expensive regex
    const hasLetterOptions = text.includes('A.') && text.includes('B.') && text.includes('C.');
    const hasNumberOptions = text.includes('1.') && text.includes('2.') && text.includes('3.');
    const hasTrueFalse = text.toLowerCase().includes('true') && text.toLowerCase().includes('false');
    
    if (!hasLetterOptions && !hasNumberOptions && !hasTrueFalse && 
        !text.toLowerCase().includes('multiple choice') && 
        !text.toLowerCase().includes('options')) {
      return false;
    }
    
    try {
      // More comprehensive patterns for MCQ detection
      
      // Look for patterns like "A.", "B.", "C.", etc. (at least 3 options)
      const letterPatterns = [
        /(?:\n|\r|\r\n|^)\s*[A-D][\.\)]\s+.*(?:\n|\r|\r\n)\s*[A-D][\.\)]\s+.*(?:\n|\r|\r\n)\s*[A-D][\.\)]\s+.*/i,
        /(?:\n|\r|\r\n|^)\s*\([A-D]\)\s+.*(?:\n|\r|\r\n)\s*\([A-D]\)\s+.*(?:\n|\r|\r\n)\s*\([A-D]\)\s+.*/i,
        /(?:^|[\n\r])Choice\s*[A-D][:\.\)]*\s+.*(?:[\n\r])Choice\s*[A-D][:\.\)]*\s+.*(?:[\n\r])Choice\s*[A-D][:\.\)]*\s+.*/i
      ];
      
      // Check for numerical options like "1.", "2.", "3.", etc.
      const numberPatterns = [
        /(?:\n|\r|\r\n|^)\s*[1-4][\.\)]\s+.*(?:\n|\r|\r\n)\s*[1-4][\.\)]\s+.*(?:\n|\r|\r\n)\s*[1-4][\.\)]\s+.*/i,
        /(?:\n|\r|\r\n|^)\s*\([1-4]\)\s+.*(?:\n|\r|\r\n)\s*\([1-4]\)\s+.*(?:\n|\r|\r\n)\s*\([1-4]\)\s+.*/i
      ];
      
      // Check for true/false questions
      const trueFalsePattern = /(?:\n|\r|\r\n|^)(?:.*)(?:true\s+or\s+false|true\/false)(?:.*?)(?:\?|\.)/i;
      
      // Check for explicit mention of multiple choice
      const explicitMentionPattern = /multiple[- ]choice|choose\s+(the|one|an)\s+(answer|option)|select\s+(the|one|an)\s+(answer|option)/i;
      
      // Test all patterns
      const isLetterMCQ = letterPatterns.some(pattern => pattern.test(text));
      const isNumberMCQ = numberPatterns.some(pattern => pattern.test(text));
      const isTrueFalse = trueFalsePattern.test(text);
      const hasExplicitMention = explicitMentionPattern.test(text);
      
      return isLetterMCQ || isNumberMCQ || isTrueFalse || 
             (hasExplicitMention && (hasLetterOptions || hasNumberOptions || hasTrueFalse));
    } catch (error) {
      console.error("🔄 Error in isMultipleChoiceQuestion:", error);
      return false; // Default to false on error
    }
  }
  
  const sidebar = document.createElement("div");
    sidebar.className = `mimir-sidebar ${sidebarSide}`;
    sidebar.id = "mimir-sidebar";
    sidebar.style.width = sidebarWidth + "px";
    document.body.appendChild(sidebar);

    const mimirHeader = document.createElement("div");
    mimirHeader.style.display = "flex";
    mimirHeader.style.justifyContent = "flex-start"; // Use flex-start for left alignment
    mimirHeader.style.alignItems = "center";
    mimirHeader.style.padding = "12px 16px";
    mimirHeader.style.color = "var(--accent-color)";
    mimirHeader.style.fontSize = "20px";
    mimirHeader.style.fontWeight = "bold";
    mimirHeader.style.flexShrink = "0";

    // Only the title, no logo
    const mimirTitle = document.createElement("div");
    mimirTitle.textContent = "Mimir";
    mimirTitle.className = "mimir-sidebar-title";
    mimirTitle.style.margin = "0";
    mimirTitle.style.textAlign = "left";
    mimirTitle.style.flex = "1"; // This pushes the close button to the right

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✖";
    closeBtn.style.border = "none";
    closeBtn.style.background = "none";
    closeBtn.style.color = "var(--accent-color)";
    closeBtn.style.fontSize = "16px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.margin = "0";
    closeBtn.style.padding = "0";
    closeBtn.onclick = () => {
      sidebar.remove();
      document.body.style.marginRight = "";
      document.body.style.marginLeft = "";
    };

    mimirHeader.appendChild(mimirTitle);
    mimirHeader.appendChild(closeBtn); // This will now be at the far right
    sidebar.appendChild(mimirHeader);

    const title = document.createElement("h3");
    title.id = "mimir-sidebar-title";
    title.style.margin = "10px";
    sidebar.appendChild(title);

    const result = document.createElement("div");
    result.className = "mimir-sidebar-results";
    result.id = "mimir-sidebar-content";
    sidebar.appendChild(result);

    // Create top buttons container
    const topButtonsContainer = document.createElement("div");
    topButtonsContainer.id = "mimir-sidebar-top-buttons";
    topButtonsContainer.style.display = "flex";
    topButtonsContainer.style.gap = "8px";
    topButtonsContainer.style.margin = "10px";
    
    // Create Enter Prompt button
    const sidebarEnterPromptBtnElem = document.createElement("button");
    sidebarEnterPromptBtnElem.id = "mimir-sidebar-enter-prompt-btn";
    sidebarEnterPromptBtnElem.textContent = "📝 Enter Prompt";
    sidebarEnterPromptBtnElem.style.backgroundColor = "var(--accent-color)";
    sidebarEnterPromptBtnElem.style.color = "white";
    sidebarEnterPromptBtnElem.style.fontWeight = "bold";
    sidebarEnterPromptBtnElem.style.padding = "6px 12px";
    sidebarEnterPromptBtnElem.style.border = "none";
    sidebarEnterPromptBtnElem.style.borderRadius = "4px";
    sidebarEnterPromptBtnElem.style.cursor = "pointer";
    sidebarEnterPromptBtnElem.style.fontSize = "14px";
    sidebarEnterPromptBtnElem.style.flex = "1";
    sidebarEnterPromptBtnElem.style.display = "block";
    
    // Create Edit Response button - initially hidden
    const sidebarEditResponseBtnElem = document.createElement("button");
    sidebarEditResponseBtnElem.id = "mimir-sidebar-edit-response-btn";
    sidebarEditResponseBtnElem.textContent = "✏️ Edit Response";
    sidebarEditResponseBtnElem.style.backgroundColor = "#555";
    sidebarEditResponseBtnElem.style.color = "white";
    sidebarEditResponseBtnElem.style.border = "none";
    sidebarEditResponseBtnElem.style.padding = "6px 12px";
    sidebarEditResponseBtnElem.style.borderRadius = "4px";
    sidebarEditResponseBtnElem.style.cursor = "pointer";
    sidebarEditResponseBtnElem.style.fontWeight = "bold";
    sidebarEditResponseBtnElem.style.fontSize = "14px";
    sidebarEditResponseBtnElem.style.flex = "1";
    sidebarEditResponseBtnElem.style.display = "none"; // Initially hidden
    
    // Add buttons to container
    topButtonsContainer.appendChild(sidebarEnterPromptBtnElem);
    topButtonsContainer.appendChild(sidebarEditResponseBtnElem);
    
    // Add prompt section
    const sidebarPromptSectionElem = document.createElement("div");
    sidebarPromptSectionElem.id = "mimir-sidebar-prompt-section";
    sidebarPromptSectionElem.style.margin = "10px";
    sidebarPromptSectionElem.style.marginBottom = "15px";
    sidebarPromptSectionElem.style.display = "none";
    
    const promptLabel = document.createElement("p");
    promptLabel.style.fontSize = "12px";
    promptLabel.style.color = "#aaa";
    promptLabel.style.margin = "0 0 5px 0";
    promptLabel.style.fontFamily = "sans-serif";
    promptLabel.textContent = "Enter an essay prompt or multiple choice question (A, B, C, D)";
    
    const sidebarPromptInputElem = document.createElement("textarea");
    sidebarPromptInputElem.id = "mimir-sidebar-prompt-input";
    sidebarPromptInputElem.placeholder = "Enter your essay prompt or question here...";
    sidebarPromptInputElem.style.width = "100%";
    sidebarPromptInputElem.style.minHeight = "80px";
    sidebarPromptInputElem.style.padding = "8px";
    sidebarPromptInputElem.style.boxSizing = "border-box";
    sidebarPromptInputElem.style.border = "1px solid #444";
    sidebarPromptInputElem.style.background = "#333";
    sidebarPromptInputElem.style.color = "#fff";
    sidebarPromptInputElem.style.borderRadius = "4px";
    sidebarPromptInputElem.style.marginBottom = "10px";
    
    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "space-between";
    
    const sidebarGeneratePromptBtnElem = document.createElement("button");
    sidebarGeneratePromptBtnElem.id = "mimir-sidebar-generate-btn";
    sidebarGeneratePromptBtnElem.textContent = "Generate Response";
    sidebarGeneratePromptBtnElem.style.backgroundColor = "var(--accent-color)";
    sidebarGeneratePromptBtnElem.style.color = "white";
    sidebarGeneratePromptBtnElem.style.border = "none";
    sidebarGeneratePromptBtnElem.style.padding = "6px 12px";
    sidebarGeneratePromptBtnElem.style.borderRadius = "4px";
    sidebarGeneratePromptBtnElem.style.cursor = "pointer";
    sidebarGeneratePromptBtnElem.style.fontWeight = "bold";
    
    const sidebarCancelPromptBtnElem = document.createElement("button");
    sidebarCancelPromptBtnElem.id = "mimir-sidebar-cancel-btn";
    sidebarCancelPromptBtnElem.textContent = "Cancel";
    sidebarCancelPromptBtnElem.style.backgroundColor = "#555";
    sidebarCancelPromptBtnElem.style.color = "white";
    sidebarCancelPromptBtnElem.style.border = "none";
    sidebarCancelPromptBtnElem.style.padding = "6px 12px";
    sidebarCancelPromptBtnElem.style.borderRadius = "4px";
    sidebarCancelPromptBtnElem.style.cursor = "pointer";
    
    buttonContainer.appendChild(sidebarGeneratePromptBtnElem);
    buttonContainer.appendChild(sidebarCancelPromptBtnElem);
    
    sidebarPromptSectionElem.appendChild(promptLabel);
    sidebarPromptSectionElem.appendChild(sidebarPromptInputElem);
    sidebarPromptSectionElem.appendChild(buttonContainer);
    
    // Add all elements to sidebar in the right order
    sidebar.appendChild(mimirHeader);
    sidebar.appendChild(title);
    sidebar.appendChild(topButtonsContainer); // Add the top buttons container here
    sidebar.appendChild(sidebarPromptSectionElem);
    sidebar.appendChild(result);
    
    const spinner = document.createElement("div");
    spinner.className = "mimir-spinner";
    spinner.id = "mimir-sidebar-spinner";
    spinner.style.display = "none";
    sidebar.appendChild(spinner);

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "mimir-toggle-btn";
    toggleBtn.id = "mimir-toggle-btn";
    toggleBtn.textContent = sidebarSide === "right" ? "<" : ">";
    toggleBtn.onclick = () => {
      sidebar.classList.remove("open");
      document.body.style.marginLeft = "";
      document.body.style.marginRight = "";
      setTimeout(() => {
        sidebarSide = sidebarSide === "right" ? "left" : "right";
        sidebar.className = `mimir-sidebar ${sidebarSide}`;
        sidebar.style.width = sidebarWidth + "px";
        toggleBtn.textContent = sidebarSide === "right" ? "<" : ">";
        document.body.style[sidebarSide === "right" ? "marginRight" : "marginLeft"] = sidebarWidth + "px";
      }, 300);
    };
    sidebar.appendChild(toggleBtn);

    const resizer = document.createElement("div");
    resizer.className = `mimir-resizer ${sidebarSide}`;
    sidebar.appendChild(resizer);

    let startX = 0;
    const resize = (e) => {
      requestAnimationFrame(() => {
        const delta = sidebarSide === "right" ? startX - e.clientX : e.clientX - startX;
        sidebarWidth = Math.max(200, Math.min(600, sidebarWidth + delta));
        sidebar.style.width = sidebarWidth + "px";
        document.body.style[sidebarSide === "right" ? "marginRight" : "marginLeft"] = sidebarWidth + "px";
        startX = e.clientX;
      });
    };

    resizer.addEventListener("mousedown", (e) => {
      startX = e.clientX;
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", resize);
      document.addEventListener("mouseup", () => {
        document.removeEventListener("mousemove", resize);
        document.body.style.userSelect = "";
      }, { once: true });
    });

    document.body.style[sidebarSide === "right" ? "marginRight" : "marginLeft"] = sidebarWidth + "px";
    sidebar.classList.add("open");
    
    // Set up Enter Prompt button functionality
    const sidebarEnterPromptBtn = document.getElementById("mimir-sidebar-enter-prompt-btn");
    const sidebarPromptSection = document.getElementById("mimir-sidebar-prompt-section");
    const sidebarGeneratePromptBtn = document.getElementById("mimir-sidebar-generate-btn");
    const sidebarCancelPromptBtn = document.getElementById("mimir-sidebar-cancel-btn");
    const sidebarPromptInput = document.getElementById("mimir-sidebar-prompt-input");
    const sidebarEditResponseBtn = document.getElementById("mimir-sidebar-edit-response-btn");
    const sidebarContent = document.getElementById("mimir-sidebar-content");
    
    if (sidebarEnterPromptBtn) {
      sidebarEnterPromptBtn.addEventListener("click", async () => {
        // Check connectivity before showing the prompt section
        if (!isOnline()) {
          sidebarContent.innerText = "You appear to be offline. Please check your internet connection and try again.";
          return;
        }
        
        try {
          // Check for more reliable connectivity info
          const connectivity = await checkConnectivity();
          if (!connectivity.online) {
            sidebarContent.innerText = connectivity.message;
            return;
          }
          
          if (connectivity.reliable === false) {
            console.warn("🔄 Unreliable connection detected:", connectivity.message);
            // We'll still continue but log the warning
          }
          
          // Get any selected text on the page
          const selection = window.getSelection();
          const selectedText = selection ? selection.toString().trim() : "";
          
          // Show prompt section and hide other elements
          sidebarPromptSection.style.display = "block";
          sidebarEnterPromptBtn.style.display = "none";
          sidebarEditResponseBtn.style.display = "none";
          sidebarContent.innerText = "";
          
          // Pre-fill the prompt input with selected text
          if (selectedText) {
            sidebarPromptInput.value = selectedText;
          }
        } catch (error) {
          console.error("🔄 Error checking connectivity:", error);
          // Continue anyway since the check itself failed
          sidebarPromptSection.style.display = "block";
          sidebarEnterPromptBtn.style.display = "none";
          sidebarEditResponseBtn.style.display = "none";
          sidebarContent.innerText = "";
          
          // Try to get selected text even if connectivity check failed
          const selection = window.getSelection();
          const selectedText = selection ? selection.toString().trim() : "";
          
          // Pre-fill the prompt input with selected text
          if (selectedText) {
            sidebarPromptInput.value = selectedText;
          }
        }
      });
    }
    
    if (sidebarCancelPromptBtn) {
      sidebarCancelPromptBtn.addEventListener("click", () => {
        // Hide prompt section and show other elements
        sidebarPromptSection.style.display = "none";
        sidebarEnterPromptBtn.style.display = "block";
        sidebarPromptInput.value = "";
      });
    }
    
    if (sidebarGeneratePromptBtn) {
      sidebarGeneratePromptBtn.addEventListener("click", async () => {
        const promptText = sidebarPromptInput.value.trim();
        if (!promptText) {
          sidebarContent.innerText = "Please enter a prompt first.";
          return;
        }

        // Show loading message with progress indicators
        const loadingDots = [".", "..", "..."];
        let dotIndex = 0;
        const loadingInterval = setInterval(() => {
          sidebarContent.innerText = "Generating response" + loadingDots[dotIndex % loadingDots.length];
          dotIndex++;
        }, 500);
        
        sidebarGeneratePromptBtn.disabled = true;

        try {
          // Determine content type (MCQ or essay)
          const isMCQ = isMultipleChoiceQuestion(promptText);
          const action = isMCQ ? "Answer MCQ" : "Generate Essay";
          
          console.log("🔄 Sidebar API Request - Action:", action, "MCQ:", isMCQ);
          
          // Create the request payload
          const payload = {
            action: action,
            text: isMCQ ? promptText.substring(0, 2000) : promptText,
            concise: isMCQ,
            speed: 'fast'
          };
          
          console.log("🔄 Sidebar API Request - Payload:", payload);
          
          // Make API request to generate content
          const response = await fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });
          
          console.log("🔄 Sidebar API Response - Status:", response.status);

          if (!response.ok) {
            console.error("🔄 Sidebar API Error - Status:", response.status);
            
            // Try a simpler fallback request with minimal parameters
            console.log("🔄 Attempting fallback API request");
            const fallbackResponse = await fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                action: action,
                text: promptText.substring(0, 1500) // Shorter text
              })
            });
            
            if (!fallbackResponse.ok) {
              throw new Error('API request failed with status: ' + response.status);
            }
            
            const data = await fallbackResponse.json();
            console.log("🔄 Sidebar API Fallback Response - Data:", data);
            return data;
          }

          const data = await response.json();
          console.log("🔄 Sidebar API Response - Data:", data);

          if (data && data.result) {
            let result = data.result;
            const isMCQ = isMultipleChoiceQuestion(promptText);
            
            console.log("🔄 Processing result - MCQ:", isMCQ, "Result:", result);
            
            if (isMCQ) {
              // Process MCQ response to extract just the letter and answer
              const letterMatch = result.match(/^[A-D][\.\)]\s+.*|(?:answer is|correct answer is|correct option is)[:\s]*([A-D][\.\)]).*|(?:True|False)[\.\)]/i);
              

              if (letterMatch) {
                if (letterMatch[0].match(/^(?:True|False)[\.\)]/i)) {
                  // Handle True/False
                  result = letterMatch[0].trim();
                } else {
                  // Handle letter answers
                  const answerLetter = letterMatch[1] ? letterMatch[1].trim() : letterMatch[0].substring(0, 2).trim();
                  
                  // Find the full answer text from original question for this letter
                  const answerPattern = new RegExp(`${answerLetter.charAt(0)}[\\.\)]\\s*(.*)`, 'i');
                  const fullAnswerMatch = promptText.match(answerPattern);
                  
                  console.log("🔄 Full answer match:", fullAnswerMatch, "for letter:", answerLetter);
                  
                  if (fullAnswerMatch && fullAnswerMatch[1]) {
                    result = `${answerLetter} ${fullAnswerMatch[1].trim()}`;
                  }
                }
              }
            }
            
            // Make sure the result is a valid string
            if (typeof result !== 'string' || !result.trim()) {
              console.log("🔄 Empty or invalid result, using fallback message");
              result = "The API returned an empty response. Please try again with a different prompt.";
            }
            
            try {
              // Display the generated response
              sidebarContent.innerText = result;
              

              // Show edit button only after successfully generating a response
              console.log("Showing sidebar edit button");
              if (sidebarEditResponseBtn) {
                sidebarEditResponseBtn.style.display = "block";
                console.log("Edit button display set to:", sidebarEditResponseBtn.style.display);
              } else {
                console.error("sidebarEditResponseBtn not found");
              }
              
              if (sidebarPromptSection) sidebarPromptSection.style.display = "none";
              if (sidebarEnterPromptBtn) sidebarEnterPromptBtn.style.display = "block";
              
              // Save the prompt and response to storage for the editor page
              if (isExtensionContextValid()) {
                chrome.storage.local.set({
                  lastPrompt: promptText,
                  lastResponse: result
                });
              }
            } catch (displayError) {
              console.error("🔄 Error displaying result:", displayError);
              sidebarContent.innerText = "Error displaying the result: " + displayError.message;
              
              // Don't show edit button if there's an error
              if (sidebarEditResponseBtn) {
                sidebarEditResponseBtn.style.display = "none";
              }
            }
          } else {
            sidebarContent.innerText = "No content was generated. Please try a different prompt.";
            
            // Don't show edit button if no content was generated
            if (sidebarEditResponseBtn) {
              sidebarEditResponseBtn.style.display = "none";
            }
          }
        } catch (error) {
          console.error('Error generating response in sidebar:', error);
          
            // More detailed error message
          let errorMessage = "An error occurred while generating the response.";
          
          // Network errors
          if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            errorMessage = "Network error: Could not connect to the API server. Please check your internet connection.";
            
            // Try using background script as proxy
            try {
              console.log("🔄 Attempting to use background script proxy for API request");
              sidebarContent.innerText = "Trying alternative connection method...";
              
              // Use the new proxyAPIRequest function
              proxyAPIRequest(
                "https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir",
                {
                  action: action,
                  text: promptText.substring(0, 1500)
                }
              )
              .then(data => {
                console.log("🔄 Proxy API request succeeded:", data);
                
                const result = data.result;
                
                if (typeof result === 'string' && result.trim()) {
                  sidebarContent.innerText = result;
                  

                  // Show edit button and hide prompt section
                  if (sidebarEditResponseBtn) sidebarEditResponseBtn.style.display = "block";
                  if (sidebarPromptSection) sidebarPromptSection.style.display = "none";
                  if (sidebarEnterPromptBtn) sidebarEnterPromptBtn.style.display = "block";
                  
                  // Save to storage
                  if (isExtensionContextValid()) {
                    chrome.storage.local.set({
                      lastPrompt: promptText,
                      lastResponse: result
                    }, () => {
                      if (chrome.runtime.lastError) {
                        console.error("🔄 Storage error:", chrome.runtime.lastError);
                      }
                    });
                  }
                } else {
                  sidebarContent.innerText = "The API returned an empty or invalid response. Please try again.";
                }
                
                return true; // To indicate we've handled the response
              })
              .catch(error => {
                console.error("🔄 Proxy API request failed:", error);
                sidebarContent.innerText = `API request failed: ${error.message}\n\nPlease try again later.`;
              });
              

              // Return early since we're handling the response in the Promise
              return;
            } catch (proxyError) {
              console.error("🔄 Background proxy request failed:", proxyError);
              sidebarContent.innerText = `Proxy error: ${proxyError.message}. Please try again later.`;
            }
          } 
          // CORS errors
          else if (error.message.includes('CORS')) {
            errorMessage = "Cross-origin request blocked: The API server is not allowing requests from this origin.";
          }
          // Server errors
          else if (error.message.includes('500')) {
            errorMessage = "Server error: The API server encountered an internal error. Please try again later.";
          }
          // Other HTTP errors
          else if (error.message.includes('status:')) {
            errorMessage = `API request failed: ${error.message}`;
          }          sidebarContent.innerText = errorMessage;
          
          // Try to use the popup flow as a fallback
          try {
            chrome.storage.local.set({
              lastPrompt: promptText
            }, () => {
              console.log("Saved prompt for manual retry in popup/editor");
            });
          } catch (storageError) {
            console.error("Could not save prompt to storage:", storageError);
          }
        } finally {
          clearInterval(loadingInterval);
          sidebarGeneratePromptBtn.disabled = false;
        }
      });
    }
    
    if (sidebarEditResponseBtn) {
      sidebarEditResponseBtn.addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("prompt-editor.html") });
      });
    }

    // Remove this section that loads the edit button from storage
    // We don't want the button to appear just because there's a saved response
    /*
    if (isExtensionContextValid()) {
      chrome.storage.local.get(['lastResponse'], function(data) {
        if (data.lastResponse && sidebarEditResponseBtn) {
          // If we have a saved response, show the Edit Response button
          console.log("Found saved response in sidebar, showing Edit button");
          sidebarEditResponseBtn.style.display = "block";
        }
      });
    }
    */
    
    if (callback) callback();
  }

  function runToolInSidebar(action, text) {
    console.log("Running tool in sidebar:", action);

    const title = document.getElementById("mimir-sidebar-title");
    const content = document.getElementById("mimir-sidebar-content");
    const spinner = document.getElementById("mimir-sidebar-spinner");

    if (!title || !content || !spinner) {
      console.warn('Sidebar elements not found');
      return;
    }

    title.textContent = action;
    content.textContent = "";
    spinner.style.display = "block";

    // Create the request body once to reuse it
    const requestBody = buildRequestBody(action, text);
    
    // Track if we need to try the proxy fallback
    let useProxyFallback = false;
    
    // First attempt with direct fetch
    fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    })
      .then(response => {
        if (!response.ok) {
          console.log("🔄 Direct API request failed with status:", response.status);
          useProxyFallback = true;
          throw new Error(`API request failed with status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        displayToolResult(data, spinner, content);
      })
      .catch(err => {
        console.error("🔄 Direct fetch error:", err.message);
        
        // If CORS error or other network issue, try the proxy
        if (useProxyFallback || err.message.includes('CORS') || err.message.includes('NetworkError')) {
          console.log("🔄 Trying proxy fallback for API request");
          content.textContent = "Connection issue detected, trying alternative method...";
          
          // Use our proxy function as fallback
          proxyAPIRequest(
            "https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir",
            requestBody
          )
          .then(data => {
            console.log("🔄 Proxy API request succeeded");
            displayToolResult(data, spinner, content);
          })
          .catch(proxyErr => {
            console.error("🔄 Proxy API request failed:", proxyErr);
            spinner.style.display = "none";
            content.textContent = `Error: ${proxyErr.message || "Failed to connect to API server."}`;
          });
        } else {
          // Not a network error, just show the error
          spinner.style.display = "none";
          content.textContent = `Error: ${err.message || "Failed to fetch."}`;
        }
      });
  }
  
  // Helper function to display tool results
  function displayToolResult(data, spinner, content) {
    spinner.style.display = "none";
    
    // Validate result
    const resultText = data && data.result ? data.result : 
                      data && data.error ? `Error: ${data.error}` : 
                      "No result returned.";
    
    // Create a container for the result
    const resultContainer = document.createElement("div");
    resultContainer.style.whiteSpace = "pre-wrap";
    
    // Create the result block
    const resultBlock = document.createElement("div");
    resultBlock.textContent = resultText;
    resultBlock.style.marginBottom = "12px";
    
    // Append result to container
    resultContainer.appendChild(resultBlock);
    
    // Clear content and append the new result
    content.innerHTML = "";
    content.appendChild(resultContainer);
  }

  // Remove the complex startScreenCapture function and replace with simple handler
  function processScreenshotFromPopup(imageData) {
    // Create or open sidebar first
    if (!document.getElementById("mimir-sidebar")) {
      createSidebar(() => {
        sendScreenshotToAPI(imageData);
      });
    } else {
      sendScreenshotToAPI(imageData);
    }
  }

  // Update sendScreenshotToAPI to handle both blob and dataURL
  async function sendScreenshotToAPI(imageData) {
    console.log("🔥 Processing screenshot...");
    
    const title = document.getElementById("mimir-sidebar-title");
    const content = document.getElementById("mimir-sidebar-content");
    const spinner = document.getElementById("mimir-sidebar-spinner");

    if (!title || !content || !spinner) {
      console.error("🔥 Sidebar elements not found!");
      return;
    }

    title.textContent = "Capture Image";
    content.textContent = "Processing screenshot...";
    spinner.style.display = "block";

    // Set a timeout for the whole operation
    let timeoutId = setTimeout(() => {
      spinner.style.display = "none";
      content.innerText = "Image processing timed out after 30 seconds. Please try again with a smaller image or different content.";
    }, 30000);
    
    try {
      let blob;
      
      // Validate image data
      if (!imageData) {
        throw new Error("No image data received");
      }
      
      if (typeof imageData === 'string') {
        // Convert dataURL to blob
        console.log("🔥 Converting dataURL to blob...");
        try {
          const response = await fetch(imageData);
          blob = await response.blob();
        } catch (dataUrlError) {
          throw new Error(`Failed to process image data: ${dataUrlError.message}`);
        }
      } else {
        blob = imageData;
      }

      // Validate the blob
      if (!blob || blob.size === 0) {
        throw new Error("Empty or invalid image data");
      }
      
      if (blob.size > 5 * 1024 * 1024) { // > 5MB
        console.warn("🔥 Large image (over 5MB) might cause issues");
        content.innerText = "Processing large image (this may take longer)...";
      }
      
      console.log("🔥 Blob size:", blob.size, "type:", blob.type);

      const formData = new FormData();
      formData.append("image", blob, "screenshot.png");

      console.log("🔥 Sending to API...");
      
      // First try direct fetch
      let res, data;
      try {
        res = await fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/capture-image", {
          method: "POST",
          body: formData
        });
        
        console.log("🔥 API response status:", res.status);
        
        data = await res.json();
        console.log("🔥 API response data:", data);
      } catch (fetchError) {
        console.error("🔥 Direct API fetch failed:", fetchError);
        
        // If there's a CORS error, try using the proxy mechanism
        // Note: For image upload, the proxy won't work directly since we need FormData
        // This is just a placeholder for potential future proxy implementation
        throw new Error(`API request failed: ${fetchError.message}`);
      }
      
      // Clear timeout as we got a response
      clearTimeout(timeoutId);
      spinner.style.display = "none";
      
      if (!res.ok) {
        console.error("🔥 API Error:", data);
        
        // Detailed error display
        let errorMessage = "Error processing screenshot.";
        if (data.error) {
          errorMessage = `Error: ${data.error}`;
        }
        
        // If OCR text was returned despite an error, show it
        if (data.ocrText) {
          errorMessage += "\n\nOCR Text (raw):\n" + data.ocrText;
        }
        
        content.innerText = errorMessage;
        return;
      }
      
      // Process successful response
      let output = "";
      
      // Handle various response formats
      if (Array.isArray(data.answers)) {
        output = data.answers.map((ans, idx) => `${idx + 1}. ${ans}`).join("\n\n");
      } else if (typeof data.answers === "string") {
        output = data.answers;
      } else if (typeof data.result === "string") {
        output = data.result;
      } else if (data.ocrText) {
        // Fallback to OCR text if no result or answers
        output = "OCR Text (raw):\n" + data.ocrText;
      } else {
        output = "No answers or text could be extracted from the image.";
      }
      
      console.log("🔥 Final output:", output);
      
      // Make sure output is a string
      if (typeof output !== 'string') {
        output = JSON.stringify(output);
      }
      
      content.innerText = output;
      
    } catch (err) {
      console.error("🔥 Error:", err);
      spinner.style.display = "none";
      content.innerText = "Error processing screenshot: " + err.message;
    }
  }

  // Screen capture functionality
  function startScreenCapture() {
    // Create capture overlay
    const overlay = document.createElement('div');
    overlay.id = 'mimir-capture-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.3);
      z-index: 999999;
      cursor: crosshair;
      user-select: none;
    `;

    const instructions = document.createElement('div');
    instructions.style.cssText = `
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--accent-color);
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 1000000;
    `;
        instructions.textContent = 'Click and drag to select area to capture. Press ESC to cancel.';
        // You may want to append the instructions and overlay to the document here
        overlay.appendChild(instructions);
        document.body.appendChild(overlay);
    
        // Add any additional logic for capturing the screen here...
      } // <-- Close startScreenCapture function
    
    // (moved to end of file
