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

// Helper function to detect if text is a multiple choice question
function isMultipleChoiceQuestion(text) {
  // Quick check for common MCQ indicators to avoid expensive regex
  if (!text.includes('A.') && !text.includes('1.') && !text.includes('option') &&
      !text.toLowerCase().includes('true') && !text.toLowerCase().includes('false')) {
    return false;
  }
  
  // Look for patterns like "A.", "B.", "C.", etc.
  const mcqPattern = /(?:\n|\r|\r\n|^)\s*[A-D][\.\)].*(?:\n|\r|\r\n)\s*[A-D][\.\)].*(?:\n|\r|\r\n)\s*[A-D][\.\)].*/i;
  // Also check for numerical options like "1.", "2.", "3.", etc.
  const numericalPattern = /(?:\n|\r|\r\n|^)\s*[1-4][\.\)].*(?:\n|\r|\r\n)\s*[1-4][\.\)].*(?:\n|\r|\r\n)\s*[1-4][\.\)].*/i;
  // Check for true/false questions
  const trueFalsePattern = /(?:\n|\r|\r\n|^)(?:.*)(?:true\s+or\s+false|true\/false)(?:.*?)(?:\?|\.)/i;
  
  return mcqPattern.test(text) || numericalPattern.test(text) || trueFalsePattern.test(text);
}

const tools = [
  { name: "Summarize", description: "Get a context-aware summary of the selected text." },
  { name: "Explain Like I'm 5", description: "Simplify the selected text so a 5-year-old could understand it." },
  { name: "Translate Text", description: "Translate selected or full-page text from any language into English." },
  { name: "Definition", description: "Define a selected word or phrase and optionally simplify it." },
  { name: "Turn Professional", description: "Polish informal writing into professional, work-ready prose." },
  { name: "Socratic Review", description: "Ask critical questions to clarify and challenge your thinking." },
  { name: "Daily Brief", description: "Summarize yesterday's notes, list tasks, and suggest what to work on." },
  { name: "Citation Finder", description: "Suggest sources or references related to the selected content." },
  { name: "Flashcard Generator", description: "Turn notes or articles into tab-separated, Anki-compatible flashcards." },
  { name: "Upload Image", description: "Upload an image to extract text and find answers." }
];

// 1) Define the palette
const themeColors = {
  default: "#4287f5",
  red:     "#A4262C",
  orange:  "#CA5010",
  darkblue:"#40587C",
  green:   "#407855",
  purple:  "#8764B8",
  teal:    "#038387",
  yellow:  "#CEA230"
};

// 2) Helper to apply a theme key to your CSS variable
function applyThemeColor(themeKey) {
  const color = themeColors[themeKey] || themeColors.default;
  document.documentElement.style.setProperty("--accent-color", color);
}

// 3) Listen for live changes to `theme` in storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.theme) {
    applyThemeColor(changes.theme.newValue);
  }
});

// (Optionally) also catch the custom `themeChanged` message
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "themeChanged" && msg.theme) {
    applyThemeColor(msg.theme);
  }
});


const toolsView = document.getElementById("toolsView");
const buttonsDiv = document.getElementById("buttons");
const lastAttempts = {};

tools.forEach(tool => {
  const toolDiv = document.createElement("div");
  toolDiv.className = "tool";

  const headerDiv = document.createElement("div");
  headerDiv.className = "tool-header";

  const actionBtn = document.createElement("button");
  actionBtn.className = "action-button";
  actionBtn.textContent = tool.name;
  actionBtn.dataset.action = tool.name;

  const descDiv = document.createElement("div");
  descDiv.className = "description";
  descDiv.textContent = tool.description;

  const spinner = document.createElement("div");
  spinner.className = "mimir-spinner";
  spinner.style.display = "none";
  
  // Add loading wave HTML to spinner with explicit styles
  spinner.innerHTML = `
    <div class="loading-wave" style="display: flex; align-items: flex-end; justify-content: center;">
      <div class="loading-bar" style="display: block; background-color: var(--accent-color);"></div>
      <div class="loading-bar" style="display: block; background-color: var(--accent-color);"></div>
      <div class="loading-bar" style="display: block; background-color: var(--accent-color);"></div>
      <div class="loading-bar" style="display: block; background-color: var(--accent-color);"></div>
    </div>
  `;
  
  headerDiv.appendChild(spinner);

  // Handle different tool types
  if (tool.name === "Upload Image") {
    actionBtn.addEventListener("click", async () => {
      const { allowed } = await checkToolAccess("Upload Image");
      if (!allowed) {
        showUpgradeModal("🔒 This tool is limited to one use per day for free users. Upgrade to Pro for unlimited access.");
        return;
      }
      // Create a hidden file input element
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.style.display = "none";

      fileInput.onchange = async () => {
        if (!fileInput.files || fileInput.files.length === 0) {
          return;
        }
        const file = fileInput.files[0];
        spinner.style.display = "block";
        headerDiv.classList.add("loading");
        document.getElementById("result").innerText = "Uploading and processing image...";

        try {
          const formData = new FormData();
          formData.append("image", file);

          const res = await fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir", {
            method: "POST",
            body: formData
          });

          if (!res.ok) {
            throw new Error(`API error: ${res.status}`);
          }

          const dataOut = await res.json();

          let outputText = "";
          if (dataOut.answers) {
            outputText += "ANSWERS:\n" + dataOut.answers + "\n\n";
          }
          if (dataOut.ocrText) {
            outputText += "EXTRACTED TEXT:\n" + dataOut.ocrText;
          }
          if (!outputText) {
            outputText = "No response from server.";
          }

          document.getElementById("result").innerText = outputText;
        } catch (error) {
          document.getElementById("result").innerText = "Error: " + error.message;
        } finally {
          spinner.style.display = "none";
          headerDiv.classList.remove("loading");
        }
      };

      // Trigger the file input dialog
      document.body.appendChild(fileInput);
      fileInput.click();
      // Remove the input after use
      fileInput.remove();
    });
  } else {
    // Handle text-based tools
    actionBtn.addEventListener("click", async () => {
      const { allowed } = await checkToolAccess(tool.name);
      if (!allowed) {
        showUpgradeModal("🔒 This tool is limited to one use per day for free users. Upgrade to Pro for unlimited access.");
        return;
      }
      // Make sure spinner is visible first thing
      spinner.style.display = "block";
      // Force a reflow to ensure the spinner shows up
      void spinner.offsetWidth;
      headerDiv.classList.add("loading");
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            func: () => window.getSelection().toString()
          },
          async (results) => {
            let selected = results[0]?.result?.trim();
            const name = tool.name;
            const allowFullPageFallback = !["Definition"].includes(name);

            if (!selected) {
              if (allowFullPageFallback) {
                if (lastAttempts[name]) {
                  chrome.scripting.executeScript(
                    {
                      target: { tabId: tabs[0].id },
                      func: () => document.body.innerText
                    },
                    async (pageResults) => {
                      const pageText = pageResults[0]?.result?.trim();
                      
                      try {
                        const res = await fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(buildRequestBody(name, pageText))
                        });

                        // Check if response is actually JSON before parsing
                        const contentType = res.headers.get('content-type');
                        if (!contentType || !contentType.includes('application/json')) {
                          const htmlResponse = await res.text();
                          console.error("Non-JSON response received:", htmlResponse.substring(0, 200));
                          throw new Error("Server returned HTML instead of JSON. Please try again.");
                        }

                        const dataOut = await res.json();
                        document.getElementById("result").innerText = (dataOut.result || dataOut.error || "No response.");
                      } catch (error) {
                        console.error("API request error:", error);
                        document.getElementById("result").innerText = "Error: " + error.message;
                      } finally {
                        spinner.style.display = "none";
                        headerDiv.classList.remove("loading");
                      }
                    }
                  );
                } else {
                  lastAttempts[name] = true;
                  document.getElementById("result").innerText = `Please select some text first or press again to ${name.toLowerCase()} the entire page.`;
                  spinner.style.display = "none";
                  headerDiv.classList.remove("loading");
                }
              } else {
                document.getElementById("result").innerText = "Please select some text first.";
                spinner.style.display = "none";
                headerDiv.classList.remove("loading");
              }
              return;
            }

            lastAttempts[name] = false;
            
            try {
              const res = await fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildRequestBody(name, selected))
              });

              // Validate response content type before parsing
              const contentType = res.headers.get('content-type');
              if (!contentType || !contentType.includes('application/json')) {
                const htmlResponse = await res.text();
                console.error("Non-JSON response received:", htmlResponse.substring(0, 200));
                throw new Error("Server returned HTML instead of JSON. Please check if the server is running properly.");
              }

              const dataOut = await res.json();
              document.getElementById("result").innerText = (dataOut.result || dataOut.error || "No response.");
            } catch (error) {
              console.error("API request error:", error);
              let errorMessage = "Error: " + error.message;
              
              // Provide more helpful error messages
              if (error.message.includes("Failed to fetch")) {
                errorMessage = "Network error: Cannot connect to server. Please check your internet connection.";
              } else if (error.message.includes("HTML instead of JSON")) {
                errorMessage = "Server error: The API server may be down or misconfigured.";
              }
              
              document.getElementById("result").innerText = errorMessage;
            } finally {
              // Hide spinner and remove 'loading' class when finished
              spinner.style.display = "none";
              headerDiv.classList.remove("loading");
            }
          }
        );
      });
    });
  }

  headerDiv.appendChild(actionBtn);
  toolDiv.appendChild(headerDiv);
  toolDiv.appendChild(descDiv);
  buttonsDiv.appendChild(toolDiv);
});

// Slide to settings and back
function slideToSettings() {
  toolsView.classList.remove("active");
  toolsView.classList.add("slide-in-right");
  const settingsView = document.getElementById("settingsView");
  settingsView.classList.add("active", "slide-in-left");
}

function slideToTools() {
  const settingsView = document.getElementById("settingsView");
  settingsView.classList.remove("active");
  settingsView.classList.add("slide-in-right");
  toolsView.classList.remove("slide-in-right");
  toolsView.classList.add("active");
}

window.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("theme", ({ theme }) => {
    applyThemeColor(theme || "default");
  });

  // Apply text effect to all buttons
  applyTextEffectToAllButtons();
  
  // Apply text effect to dynamically created buttons
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach(node => {
          // Check if the added node is a button
          if (node.nodeType === 1 && node.tagName === 'BUTTON') {
            applyTextEffectToButton(node);
          }
          
          // Check if the added node contains buttons
          if (node.nodeType === 1) {
            const buttons = node.querySelectorAll('button');
            buttons.forEach(button => {
              applyTextEffectToButton(button);
            });
          }
        });
      }
    });
  });
  
  // Start observing the document for added buttons
  observer.observe(document.body, { childList: true, subtree: true });

  // Initialize theme selector in settings view
  const themeSelector = document.getElementById("themeSelector");
  if (themeSelector) {
    chrome.storage.local.get("theme", ({ theme }) => {
      // Set the current theme in the dropdown
      if (theme) {
        themeSelector.value = theme;
      }
      
      // Add event listener for theme changes
      themeSelector.addEventListener("change", () => {
        const newTheme = themeSelector.value;
        chrome.storage.local.set({ theme: newTheme }, () => {
          // Apply the theme immediately
          applyThemeColor(newTheme);
          
          // Send messages to update icon and other components
          chrome.runtime.sendMessage({ type: "themeChanged", theme: newTheme });
          chrome.runtime.sendMessage({ type: "setIconByTheme", theme: newTheme });
        });
      });
    });
  }

  // Attach Settings
  const openSettings = document.getElementById("openSettings");
  if (openSettings) {
    openSettings.addEventListener("click", () => {
      slideToSettings();
    });
  }
  
  // Attach back button in settings
  const backToTools = document.getElementById("backToTools");
  if (backToTools) {
    backToTools.addEventListener("click", () => {
      slideToTools();
    });
  }

  // Attach Blink search functionality
  const blinkSearch = document.getElementById("blinkSearch");
  const blinkIcon = document.getElementById("blinkIcon");
  const blinkSpinner = document.getElementById("blinkSpinner");
  const resultDiv = document.getElementById("result");

  if (blinkSearch && blinkIcon) {
    // Execute search when clicking the icon
    blinkIcon.addEventListener("click", () => {
      handleBlinkSearch();
    });

    // Execute search on Enter key press
    blinkSearch.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleBlinkSearch();
      }
    });
  }

  // Attach Enter Prompt
  const enterPromptBtn = document.getElementById("enterPromptBtn");
  const editTextBtn = document.getElementById("editTextBtn");
  const promptSection = document.getElementById("promptSection");
  const generatePromptBtn = document.getElementById("generatePromptBtn");
  const cancelPromptBtn = document.getElementById("cancelPromptBtn");
  const promptInput = document.getElementById("promptInput");
  const editResponseBtn = document.getElementById("editResponseBtn");
  const buttonsDivPrompt = document.getElementById("buttons"); 
  const topButtonsContainer = document.getElementById("topButtonsContainer");
  const blinkSearchContainer = document.getElementById("blinkSearchContainer");
  let lastGeneratedResponse = "";

  // Initially hide the edit response button
  if (editResponseBtn) {
    editResponseBtn.style.display = "none";
  }

  // Add event listener for the Edit Text button
  if (editTextBtn) {
    editTextBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("prompt-editor.html") });
    });
  }

  if (enterPromptBtn) {
    enterPromptBtn.addEventListener("click", () => {
      // Get any selected text from the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            func: () => window.getSelection().toString()
          },
          (results) => {
            const selectedText = results[0]?.result?.trim() || "";
            
            // Show prompt section and hide other elements
            promptSection.style.display = "block";
            buttonsDivPrompt.style.display = "none";
            resultDiv.innerText = "";
            editResponseBtn.style.display = "none";
            
            // Pre-fill the prompt input with selected text
            if (selectedText) {
              promptInput.value = selectedText;
            }

            // Hide blink search and top buttons when prompt section is visible
            if (topButtonsContainer) topButtonsContainer.style.display = "none";
            if (blinkSearchContainer) blinkSearchContainer.style.display = "none";
          }
        );
      });
    });
  }

  if (cancelPromptBtn) {
    cancelPromptBtn.addEventListener("click", () => {
      // Hide prompt section and show other elements
      promptSection.style.display = "none";
      buttonsDivPrompt.style.display = "block";
      promptInput.value = "";
      
      // Show Edit Text button again if it was hidden
      if (editTextBtn) {
        editTextBtn.style.display = "block";
      }

      // Show blink search and top buttons when prompt section is hidden
      if (topButtonsContainer) topButtonsContainer.style.display = "flex";
      if (blinkSearchContainer) blinkSearchContainer.style.display = "block";
    });
  }

  if (generatePromptBtn) {
    generatePromptBtn.addEventListener("click", async () => {
      const promptText = promptInput.value.trim();
      
      if (!promptText) {
        resultDiv.innerText = "Please enter a prompt before generating a response.";
        return;
      }
      
      generatePromptBtn.disabled = true;
      generatePromptBtn.textContent = "Generating...";
      
      try {
        const isMCQ = isMultipleChoiceQuestion(promptText);
        
        const res = await fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: isMCQ ? "Answer MCQ" : "Essay Response",
            text: promptText,
            detailed: true
          })
        });
        
        // Validate response content type
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const htmlResponse = await res.text();
          console.error("Non-JSON response received:", htmlResponse.substring(0, 200));
          throw new Error("Server returned HTML instead of JSON. The API server may be experiencing issues.");
        }
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(errorData.error || `API error: ${res.status}`);
        }
        
        const dataOut = await res.json();
        const response = dataOut.result || dataOut.error || "No response received from the server.";
        
        lastGeneratedResponse = response;
        resultDiv.innerText = response;
        promptSection.style.display = "none";
        buttonsDivPrompt.style.display = "block";
        
        if (editResponseBtn) {
          editResponseBtn.style.display = "block";
        }
        
        if (topButtonsContainer) topButtonsContainer.style.display = "flex";
        if (blinkSearchContainer) blinkSearchContainer.style.display = "block";
        if (editTextBtn) {
          editTextBtn.style.display = "block";
        }
        
      } catch (error) {
        console.error("Generate prompt error:", error);
        let errorMessage = `Error: ${error.message}`;
        
        // Provide more helpful error messages
        if (error.message.includes("Failed to fetch")) {
          errorMessage = "Network error: Cannot connect to server. Please check your internet connection and try again.";
        } else if (error.message.includes("HTML instead of JSON")) {
          errorMessage = "Server error: The API server is not responding correctly. Please try again later.";
        }
        
        resultDiv.innerText = errorMessage + "\n\nPlease try again.";
      } finally {
        generatePromptBtn.disabled = false;
        generatePromptBtn.textContent = "Generate Response";
      }
    });
  }

  // Modify editResponseBtn click handler to open prompt-editor.html and pass lastGeneratedResponse
  if (editResponseBtn) {
    editResponseBtn.addEventListener("click", () => {
      // Store lastGeneratedResponse in chrome.storage.local for prompt-editor to load into editor
      chrome.storage.local.set({ promptEditorEditText: lastGeneratedResponse || "" }, () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("prompt-editor.html") });
      });
    });
  }

  // Add Enter key support for promptInput to trigger generatePromptBtn click
  if (promptInput) {
    promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        generatePromptBtn.click();
      }
    });
  }

  // Inject RobotoCondensed-MediumItalic font-face for modal if not already present
  if (!document.getElementById("mimir-upgrade-modal-font")) {
    const fontStyle = document.createElement("style");
    fontStyle.id = "mimir-upgrade-modal-font";
    fontStyle.textContent = `
      @font-face {
        font-family: 'RobotoCondensedMediumItalic';
        src: url('RobotoCondensed-MediumItalic.ttf') format('truetype');
        font-style: italic;
        font-weight: normal;
      }
      #mimir-upgrade-modal, #mimir-upgrade-modal * {
        font-family: 'RobotoCondensedMediumItalic', Arial, sans-serif !important;
      }
      #mimir-upgrade-modal .mimir-upgrade-modal-content {
        font-style: normal !important;
      }
      #mimir-upgrade-modal-close {
        transition: none !important;
        background: none !important;
        color: #aaa !important;
        border: none !important;
        font-size: 13px !important;
        cursor: pointer !important;
        font-style: normal !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        outline: none !important;
        line-height: 1.2 !important;
        vertical-align: middle !important;
        position: static !important;
        min-width: 0 !important;
        min-height: 0 !important;
        height: auto !important;
      }
      #mimir-upgrade-modal-close:hover {
        color: #aaa !important;
        background: none !important;
        transform: none !important;
        box-shadow: none !important;
        outline: none !important;
        position: static !important;
        top: auto !important;
        left: auto !important;
      }
    `;
    document.head.appendChild(fontStyle);
  }

  // Modal for upgrade prompt
  if (!document.getElementById("mimir-upgrade-modal")) {
    const modal = document.createElement("div");
    modal.id = "mimir-upgrade-modal";
    modal.style.cssText = `
      display: none; position: fixed; z-index: 9999; left: 0; top: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.45); justify-content: center; align-items: center;
    `;
    modal.innerHTML = `
      <div class="mimir-upgrade-modal-content" style="
        background: #232323; color: #fff; border-radius: 10px; padding: 28px 24px 20px 24px; min-width: 260px; max-width: 340px; box-shadow: 0 8px 32px #0008; text-align: center; position: relative; font-style: normal;">
        <div style="font-size: 20px; font-weight: bold; margin-bottom: 10px; font-style: normal;">Upgrade to Mimir Pro</div>
        <div id="mimir-upgrade-modal-msg" style="font-size: 15px; margin-bottom: 18px; font-style: normal;"></div>
        <a id="mimir-upgrade-modal-btn" href="https://mimir-server-daemosthene-mimir-extension.vercel.app/api/create-checkout" target="_blank"
          style="display: inline-block; background: var(--accent-color,#4287f5); color: #fff; font-weight: bold; padding: 8px 18px; border-radius: 5px; text-decoration: none; font-size: 15px; margin-bottom: 10px; font-style: normal;">
          Go Pro
        </a>
        <br>
      </div>
    `;
    document.body.appendChild(modal);

    // Remove the close button and add overlay click-to-close
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });
  }
});

// Helper to show the upgrade modal with a custom message
function showUpgradeModal(msg) {
  const modal = document.getElementById("mimir-upgrade-modal");
  if (modal) {
    document.getElementById("mimir-upgrade-modal-msg").innerText = msg || "This feature is limited to Pro users.";
    modal.style.display = "flex";
  }
}

// Tools that are gated for free users (1 use/day)
const gatedTools = [
  "Turn Professional", "Socratic Review", "Daily Brief", "Citation Finder",
  "Flashcard Generator", "Upload Image", "Enter Prompt", "Blink"
];

// Helper to check if user is Pro and if tool is gated
function checkToolAccess(toolName) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["isProUser", "usage"], ({ isProUser, usage }) => {
      if (isProUser) return resolve({ allowed: true });
      const today = new Date().toISOString().split('T')[0];
      usage = usage || {};
      const dayUsage = usage[today] || {};
      // Only 1 use per day for gated tools
      if (gatedTools.includes(toolName)) {
        const count = dayUsage[toolName] || 0;
        if (count < 1) {
          // Increment usage
          dayUsage[toolName] = count + 1;
          usage[today] = dayUsage;
          chrome.storage.local.set({ usage }, () => resolve({ allowed: true }));
        } else {
          resolve({ allowed: false });
        }
      } else {
        resolve({ allowed: true });
      }
    });
  });
}

// --- Stripe Pro Upgrade Integration ---
// Listen for Go Pro button click to start checkout and store sessionId
document.body.addEventListener("click", async (e) => {
  const btn = e.target.closest("#mimir-upgrade-modal-btn");
  if (btn) {
    e.preventDefault();
    // Start checkout session via backend
    try {
      const res = await fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/create-checkout", {
        method: "POST"
      });
      const data = await res.json();
      if (data.url && data.sessionId) {
        // Store sessionId for later verification
        chrome.storage.local.set({ checkoutSessionId: data.sessionId });
        window.open(data.url, "_blank");
      } else if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      alert("Failed to start checkout: " + err.message);
    }
  }
});

// On popup load, check if we have a checkoutSessionId and verify Pro status
chrome.storage.local.get("checkoutSessionId", ({ checkoutSessionId }) => {
  if (checkoutSessionId) {
    verifyProStatus(checkoutSessionId);
  }
});

// Helper to verify Pro status and update storage
async function verifyProStatus(sessionId) {
  try {
    const res = await fetch(
      `https://mimir-server-daemosthene-mimir-extension.vercel.app/api/verify-subscription?sessionId=${sessionId}`
    );
    const { status } = await res.json();
    const isActive = status === "active";
    chrome.storage.local.set({ isProUser: isActive });
  } catch (err) {
    // Optionally handle error
  }
}

// Function to handle Blink search
async function handleBlinkSearch() {
  const resultDiv = document.getElementById("result");
  const blinkSearch = document.getElementById("blinkSearch");
  const blinkSpinner = document.getElementById("blinkSpinner");
  const inputContainer = document.querySelector(".input-container");

  const query = blinkSearch.value.trim();
  if (!query) {
    resultDiv.innerText = "Please enter a question.";
    return;
  }

  const { allowed } = await checkToolAccess("Blink");
  if (!allowed) {
    showUpgradeModal("🔒 Blink is limited to one use per day for free users. Upgrade to Pro for unlimited access.");
    return;
  }

  blinkSpinner.style.display = "block";
  inputContainer.classList.add("with-spinner");
  resultDiv.innerText = "Finding the quickest answer...";

  try {
    const response = await fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "Blink",
        text: query,
        maxWords: 25,
        concise: true
      })
    });

    // Validate response content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const htmlResponse = await response.text();
      console.error("Blink non-JSON response:", htmlResponse.substring(0, 200));
      throw new Error("Server returned HTML instead of JSON");
    }

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    if (data.result) {
      resultDiv.innerText = data.result;
    } else if (data.error) {
      resultDiv.innerText = `Error: ${data.error}`;
    } else {
      resultDiv.innerText = "No answer found.";
    }
  } catch (error) {
    console.error("Blink search error:", error);
    let errorMessage = "Error: Could not get an answer.";
    
    if (error.message.includes("Failed to fetch")) {
      errorMessage = "Network error: Cannot connect to server. Please check your connection.";
    } else if (error.message.includes("HTML instead of JSON")) {
      errorMessage = "Server error: API server is not responding correctly.";
    }
    
    resultDiv.innerText = errorMessage + " Please try again.";
  } finally {
    blinkSpinner.style.display = "none";
    inputContainer.classList.remove("with-spinner");
  }
}

// Function to apply the text animation effect to buttons
function applyTextEffectToButton(button) {
  // Skip if button already has the effect applied
  if (button.querySelector('.span-mother')) {
    return;
  }
  
  // Skip dropdown toggle buttons (the ones with just an arrow)
  if (button.classList.contains('toggle-description')) {
    return;
  }
  
  // Skip Enter Prompt, Edit Text, Edit Response, and Settings buttons - completely exclude them from animation
  if (button.id === 'enterPromptBtn' || 
      button.id === 'editTextBtn' || 
      button.id === 'editResponseBtn' ||
      button.id === 'openSettings' ||
      button.id === 'generatePromptBtn' ||
      button.id === 'cancelPromptBtn' ||
      button.id === 'backToTools') {
    return;
  }
  
  // Get the current button text and preserve original text for restoring if needed
  const buttonText = button.textContent.trim();
  button.dataset.originalText = buttonText;
  
  // Save original styles to apply to the spans
  const computedStyle = window.getComputedStyle(button);
  const fontFamily = computedStyle.fontFamily;
  const fontSize = computedStyle.fontSize;
  const fontWeight = computedStyle.fontWeight;
  const color = computedStyle.color;
  
  // Create the span structure for animation
  const spanMother = document.createElement('span');
  spanMother.className = 'span-mother';
  spanMother.style.fontFamily = fontFamily;
  spanMother.style.fontSize = fontSize;
  spanMother.style.fontWeight = fontWeight;
  spanMother.style.color = color;
  
  const spanMother2 = document.createElement('span');
  spanMother2.className = 'span-mother2';
  spanMother2.style.fontFamily = fontFamily;
  spanMother2.style.fontSize = fontSize;
  spanMother2.style.fontWeight = fontWeight;
  spanMother2.style.color = color;
  
  // Special handling for Enter Prompt and Edit Text buttons
  const isSpecialButton = button.id === 'enterPromptBtn' || button.id === 'editTextBtn';
  
  // Split text into individual characters and create spans
  // Using Array.from to properly handle spaces and special characters
  Array.from(buttonText).forEach(char => {
    const span1 = document.createElement('span');
    // Use non-breaking space for actual spaces to preserve them
    span1.textContent = char === ' ' ? '\u00A0' : char;
    span1.style.fontFamily = fontFamily;
    span1.style.fontSize = fontSize;
    span1.style.fontWeight = fontWeight;
    span1.style.color = color;
    // For special buttons, ensure no transform is applied to individual spans
    if (isSpecialButton) {
      span1.style.transform = 'none';
    }
    spanMother.appendChild(span1);
    
    const span2 = document.createElement('span');
    span2.textContent = char === ' ' ? '\u00A0' : char;
    span2.style.fontFamily = fontFamily;
    span2.style.fontSize = fontSize;
    span2.style.fontWeight = fontWeight;
    span2.style.color = color;
    // For special buttons, ensure no transform is applied to individual spans
    if (isSpecialButton) {
      span2.style.transform = 'none';
    }
    spanMother2.appendChild(span2);
  });
  
  // Clear the button's original content and add the new spans
  button.textContent = '';
  button.appendChild(spanMother);
  button.appendChild(spanMother2);
}

// Function to apply text effect to all buttons in the document
function applyTextEffectToAllButtons() {
  // Get all buttons
  const buttons = document.querySelectorAll('button');
  
  // Apply the effect to each button
  buttons.forEach(button => {
    applyTextEffectToButton(button);
  });
}