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
  { name: "Capture Image", description: "Take a screenshot of your screen to analyze questions and get answers." }
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
  if (tool.name === "Capture Image") {
    actionBtn.addEventListener("click", async () => {
      spinner.style.display = "block";
      headerDiv.classList.add("loading");
      document.getElementById("result").innerText = "Preparing screen capture...";

      try {
        // Get active tab first
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || !tabs[0]) {
          throw new Error("No active tab found");
        }

        const tab = tabs[0];
        console.log("🔥 Active tab:", tab.url);

        // Check if tab URL is restricted
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
          throw new Error("Cannot capture on restricted pages");
        }

        // Instead of injecting content.js here, send a message to the content script already injected by manifest
        // Check if content script is injected by manifest.json content_scripts

        // Send message to content script to start area selection
        const response = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Message timeout - content script not responding"));
          }, 5000);

          chrome.tabs.sendMessage(tab.id, { type: "start_area_selection" }, (response) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });

        console.log("🔥 Area selection response:", response);

        // Close popup so user can see the selection overlay
        setTimeout(() => {
          window.close();
        }, 100);

      } catch (error) {
        console.error("🔥 Error in capture image:", error);
        document.getElementById("result").innerText = "Error: " + error.message + "\n\nTry refreshing the page and trying again.";
        spinner.style.display = "none";
        headerDiv.classList.remove("loading");
      }
    });
  } else {
    // Handle text-based tools
    actionBtn.addEventListener("click", () => {
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
                      // Always allow, no usage tracking
                      const res = await fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(buildRequestBody(name, pageText))
                      });

                      const dataOut = await res.json();
                      document.getElementById("result").innerText = (dataOut.result || "No response.");
                      spinner.style.display = "none";
                      headerDiv.classList.remove("loading");
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
            // Always allow, no usage tracking
            try {
              const res = await fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildRequestBody(name, selected))
              });
              const dataOut = await res.json();
              document.getElementById("result").innerText = (dataOut.result || "No response.");
            } catch (error) {
              document.getElementById("result").innerText = "Error: " + error.message;
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
      // Get the prompt text
      const promptText = promptInput.value.trim();
      
      // Validate input
      if (!promptText) {
        resultDiv.innerText = "Please enter a prompt before generating a response.";
        return;
      }
      
      // Show loading state
      generatePromptBtn.disabled = true;
      generatePromptBtn.textContent = "Generating...";
      
      try {
        // Determine if it's likely a multiple choice question
        const isMCQ = isMultipleChoiceQuestion(promptText);
        
        // Call the API
        const res = await fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: isMCQ ? "Answer MCQ" : "Essay Response",
            text: promptText,
            detailed: true
          })
        });
        
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        
        const dataOut = await res.json();
        const response = dataOut.result || "No response received from the server.";
        
        // Save the response
        lastGeneratedResponse = response;
        
        // Update UI
        resultDiv.innerText = response;
        promptSection.style.display = "none";
        buttonsDivPrompt.style.display = "block";
        
        // Show the edit response button
        if (editResponseBtn) {
          editResponseBtn.style.display = "block";
        }
        
        // Show blink search and top buttons again
        if (topButtonsContainer) topButtonsContainer.style.display = "flex";
        if (blinkSearchContainer) blinkSearchContainer.style.display = "block";
        
        // Show the edit text button
        if (editTextBtn) {
          editTextBtn.style.display = "block";
        }
        
      } catch (error) {
        resultDiv.innerText = `Error: ${error.message}\n\nPlease try again.`;
      } finally {
        // Reset button state
        generatePromptBtn.disabled = false;
        generatePromptBtn.textContent = "Generate Response";
      }
    });
  }

  // Modify editTextBtn click handler to open prompt-editor.html and pass lastGeneratedResponse
  if (editTextBtn) {
    editTextBtn.addEventListener("click", () => {
      // Store lastGeneratedResponse in chrome.storage.local for prompt-editor to load
      chrome.storage.local.set({ promptEditorInitialText: lastGeneratedResponse || "" }, () => {
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
});

// Function to handle Blink search
function handleBlinkSearch() {
  const resultDiv = document.getElementById("result");
  const blinkSearch = document.getElementById("blinkSearch");
  const blinkSpinner = document.getElementById("blinkSpinner");
  const inputContainer = document.querySelector(".input-container");
  
  const query = blinkSearch.value.trim();
  if (!query) {
    resultDiv.innerText = "Please enter a question.";
    return;
  }

  // Show spinner and clear previous results
  blinkSpinner.style.display = "block";
  // Add 'with-spinner' class to slide the input
  inputContainer.classList.add("with-spinner");
  resultDiv.innerText = "Finding the quickest answer...";

  // Call the API with a custom action for Blink
  fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "Blink",
      text: query,
      maxWords: 25, // Request very concise answers
      concise: true
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error("API request failed");
    }
    return response.json();
  })
  .then(data => {
    blinkSpinner.style.display = "none";
    // Remove 'with-spinner' class to slide the input back
    inputContainer.classList.remove("with-spinner");
    if (data.result) {
      resultDiv.innerText = data.result;
    } else {
      resultDiv.innerText = "No answer found.";
    }
  })
  .catch(error => {
    blinkSpinner.style.display = "none";
    // Remove 'with-spinner' class to slide the input back
    inputContainer.classList.remove("with-spinner");
    resultDiv.innerText = "Error: Could not get an answer. Please try again.";
    console.error("Blink search error:", error);
  });
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
  
  // Skip Enter Prompt, Edit Text, and Settings buttons - completely exclude them from animation
  if (button.id === 'enterPromptBtn' || 
      button.id === 'editTextBtn' || 
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