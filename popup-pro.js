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
  if (!text.includes('A.') && !text.includes('1.') && !text.includes('option') &&
      !text.toLowerCase().includes('true') && !text.toLowerCase().includes('false')) {
    return false;
  }
  
  const mcqPattern = /(?:\n|\r|\r\n|^)\s*[A-D][\.\)].*(?:\n|\r|\r\n)\s*[A-D][\.\)].*(?:\n|\r|\r\n)\s*[A-D][\.\)].*/i;
  const numericalPattern = /(?:\n|\r|\r\n|^)\s*[1-4][\.\)].*(?:\n|\r|\r\n)\s*[1-4][\.\)].*(?:\n|\r|\r\n)\s*[1-4][\.\)].*/i;
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

// Theme colors and functions (same as regular popup.js)
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

function applyThemeColor(themeKey) {
  const color = themeColors[themeKey] || themeColors.default;
  document.documentElement.style.setProperty("--accent-color", color);
}

// ...existing chrome.storage listeners and message handlers...

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
  
  spinner.innerHTML = `
    <div class="loading-wave" style="display: flex; align-items: flex-end; justify-content: center;">
      <div class="loading-bar" style="display: block; background-color: var(--accent-color);"></div>
      <div class="loading-bar" style="display: block; background-color: var(--accent-color);"></div>
      <div class="loading-bar" style="display: block; background-color: var(--accent-color);"></div>
      <div class="loading-bar" style="display: block; background-color: var(--accent-color);"></div>
    </div>
  `;
  
  headerDiv.appendChild(spinner);

  // Handle different tool types with improved error handling
  if (tool.name === "Upload Image") {
    actionBtn.addEventListener("click", async () => {
      // Pro users have unlimited access
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

          // Validate response content type
          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const htmlResponse = await res.text();
            console.error("Upload non-JSON response:", htmlResponse.substring(0, 200));
            throw new Error("Server returned HTML instead of JSON. API server may be down.");
          }

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(errorData.error || `API error: ${res.status}`);
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
          console.error("Upload error:", error);
          let errorMessage = "Error: " + error.message;
          
          if (error.message.includes("Failed to fetch")) {
            errorMessage = "Network error: Cannot connect to server. Please check your connection.";
          } else if (error.message.includes("HTML instead of JSON")) {
            errorMessage = "Server error: API server is not responding correctly.";
          }
          
          document.getElementById("result").innerText = errorMessage;
        } finally {
          spinner.style.display = "none";
          headerDiv.classList.remove("loading");
        }
      };

      document.body.appendChild(fileInput);
      fileInput.click();
      fileInput.remove();
    });
  } else {
    // Handle text-based tools with improved error handling
    actionBtn.addEventListener("click", async () => {
      // Pro users have unlimited access - no gating
      
      spinner.style.display = "block";
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

                        const contentType = res.headers.get('content-type');
                        if (!contentType || !contentType.includes('application/json')) {
                          const htmlResponse = await res.text();
                          console.error("Non-JSON response:", htmlResponse.substring(0, 200));
                          throw new Error("Server returned HTML instead of JSON. Please try again.");
                        }

                        const dataOut = await res.json();
                        document.getElementById("result").innerText = (dataOut.result || dataOut.error || "No response.");
                      } catch (error) {
                        console.error("API request error:", error);
                        let errorMessage = "Error: " + error.message;
                        
                        if (error.message.includes("Failed to fetch")) {
                          errorMessage = "Network error: Cannot connect to server. Please check your connection.";
                        } else if (error.message.includes("HTML instead of JSON")) {
                          errorMessage = "Server error: The API server may be down. Please try again later.";
                        }
                        
                        document.getElementById("result").innerText = errorMessage;
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

              const contentType = res.headers.get('content-type');
              if (!contentType || !contentType.includes('application/json')) {
                const htmlResponse = await res.text();
                console.error("Non-JSON response:", htmlResponse.substring(0, 200));
                throw new Error("Server returned HTML instead of JSON. Please check server status.");
              }

              const dataOut = await res.json();
              document.getElementById("result").innerText = (dataOut.result || dataOut.error || "No response.");
            } catch (error) {
              console.error("API request error:", error);
              let errorMessage = "Error: " + error.message;
              
              if (error.message.includes("Failed to fetch")) {
                errorMessage = "Network error: Cannot connect to server. Please check your internet connection.";
              } else if (error.message.includes("HTML instead of JSON")) {
                errorMessage = "Server error: The API server may be down or misconfigured.";
              }
              
              document.getElementById("result").innerText = errorMessage;
            } finally {
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

// ...existing slide functions, event listeners, and other code with same improvements...
