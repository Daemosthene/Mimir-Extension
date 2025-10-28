// Initialize bubble mode functionality
document.addEventListener('DOMContentLoaded', function() {
    // Get current theme and apply it
    chrome.storage.local.get("theme", ({ theme }) => {
        const currentTheme = theme || "default";
        applyBubbleTheme(currentTheme);
    });
    
    // Listen for theme changes
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.theme) {
            applyBubbleTheme(changes.theme.newValue);
        }
    });
    
    // Function to apply theme to bubble mode
    function applyBubbleTheme(themeKey) {
        const themeColors = {
            default: "#4287f5",
            red: "#A4262C",
            orange: "#CA5010",
            darkblue: "#40587C",
            green: "#407855",
            purple: "#8764B8",
            teal: "#038387",
            yellow: "#CEA230",
            white: "#ffffff",
            black: "#000000"
        };
        
        const accentColor = themeColors[themeKey] || themeColors.default;
        
        // Update CSS custom property
        document.documentElement.style.setProperty("--accent-color", accentColor);
        
        // Update bubble container elements
        const bubbleContainer = document.getElementById('bubbleMode');
        const bubbleHeader = bubbleContainer.querySelector('.bubble-header');
        const bubbleResult = document.getElementById('bubbleResult');
        const toolButtons = document.querySelectorAll('.bubble-tool-btn');
        
        if (bubbleContainer) {
            bubbleContainer.style.borderColor = accentColor;
        }
        
        if (bubbleHeader) {
            // Special handling for white theme - keep text white
            if (accentColor === "#ffffff") {
                bubbleHeader.style.color = "#ffffff";
            } else {
                bubbleHeader.style.color = accentColor;
            }
        }
        
        if (bubbleResult) {
            bubbleResult.style.borderColor = accentColor.replace('#', 'rgba(').replace(/^rgba\(/, '').replace(')', ', 0.3)');
        }
        
        // Update tool buttons with special handling for black theme
        toolButtons.forEach(button => {
            button.style.backgroundColor = accentColor;
            
            // Add white border for black theme to make buttons visible
            if (accentColor === "#000000") {
                button.style.border = "1px solid #ffffff";
                button.style.color = "#ffffff";
            } else if (accentColor === "#ffffff") {
                button.style.border = "none";
                button.style.color = "#000000";
            } else {
                button.style.border = "none";
                button.style.color = "#ffffff";
            }
        });
        
        // Update dynamic styles
        const style = document.createElement('style');
        style.id = 'bubble-theme-styles';
        style.textContent = `
            .bubble-tool-btn:hover {
                background-color: ${accentColor}dd !important;
                ${accentColor === "#000000" ? "border: 1px solid #ffffff !important;" : ""}
            }
            .bubble-result::-webkit-scrollbar-thumb {
                background: ${accentColor.replace('#', 'rgba(').replace(/^rgba\(/, '').replace(')', ', 0.6)')};
            }
            .bubble-result::-webkit-scrollbar-thumb:hover {
                background: ${accentColor.replace('#', 'rgba(').replace(/^rgba\(/, '').replace(')', ', 0.8)')};
            }
        `;
        
        // Remove old theme styles
        const oldStyle = document.getElementById('bubble-theme-styles');
        if (oldStyle) {
            oldStyle.remove();
        }
        
        document.head.appendChild(style);
    }
    
    const bubbleContainer = document.getElementById('bubbleMode');
    const closeBtn = document.getElementById('closeBtn');
    const bubbleResult = document.getElementById('bubbleResult');
    const bubbleResultClose = document.getElementById('bubbleResultClose');
    
    // Close button functionality
    closeBtn.addEventListener('click', function() {
        hideBubble();
    });
    
    // Result close button functionality
    if (bubbleResultClose) {
        bubbleResultClose.addEventListener('click', function(e) {
            e.stopPropagation();
            bubbleResult.style.display = 'none';
        });
    }
    
    // Make bubble draggable
    let isDragging = false;
    let startX, startY, initialX, initialY;
    
    bubbleContainer.addEventListener('mousedown', function(e) {
        if (e.target === closeBtn || e.target === bubbleResultClose) return;
        if (e.target.classList.contains('bubble-tool-btn')) return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        // Get current position, handling both positioned and non-positioned elements
        const rect = bubbleContainer.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        
        // Ensure the bubble has fixed positioning and dimensions
        bubbleContainer.style.position = 'fixed';
        bubbleContainer.style.left = initialX + 'px';
        bubbleContainer.style.top = initialY + 'px';
        bubbleContainer.style.width = '300px'; // Lock width
        bubbleContainer.style.height = '210px'; // Lock height to prevent expansion
        bubbleContainer.style.minHeight = '210px'; // Maintain minimum height
        bubbleContainer.style.maxHeight = '310px'; // Maintain maximum height
        bubbleContainer.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        // Update position with bounds checking
        let newLeft = initialX + deltaX;
        let newTop = initialY + deltaY;
        
        // Constrain within the viewport
        const minLeft = 10;
        const minTop = 10;
        const maxLeft = window.innerWidth - 300 - 10; // Use fixed width for calculation
        const maxTop = window.innerHeight - bubbleContainer.offsetHeight - 10;
        
        if (newLeft < minLeft) newLeft = minLeft;
        if (newTop < minTop) newTop = minTop;
        if (newLeft > maxLeft) newLeft = maxLeft;
        if (newTop > maxTop) newTop = maxTop;
        
        bubbleContainer.style.left = newLeft + 'px';
        bubbleContainer.style.top = newTop + 'px';
    });
    
    document.addEventListener('mouseup', function() {
        isDragging = false;
        bubbleContainer.style.cursor = 'grab';
    });
    
    // Add tool button functionality
    const toolButtons = document.querySelectorAll('.bubble-tool-btn');
    toolButtons.forEach(button => {
        button.addEventListener('click', async function(e) {
            e.stopPropagation();
            const toolName = button.dataset.tool;
            
            // Show result area
            bubbleResult.style.display = 'block';
            bubbleResult.innerHTML = `
                <button class="result-close-btn" id="bubbleResultClose">&times;</button>
                Processing ${toolName}...
            `;
            
            // Re-attach close button event listener
            const newCloseBtn = document.getElementById('bubbleResultClose');
            if (newCloseBtn) {
                newCloseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    bubbleResult.style.display = 'none';
                });
            }
            
            try {
                if (toolName === "Upload Image") {
                    await handleImageUpload();
                } else if (toolName === "Enter Prompt") {
                    handleEnterPrompt();
                } else if (toolName === "Blink") {
                    handleBlinkPrompt();
                } else {
                    await handleTextTool(toolName);
                }
            } catch (error) {
                showResult(`Error: ${error.message}`);
            }
        });
        
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.1)';
            // Get the current theme color from CSS custom property
            const currentAccentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
            const hoverColor = currentAccentColor + 'dd';
            button.style.backgroundColor = hoverColor;
            
            // Maintain border for black theme on hover
            if (currentAccentColor === "#000000") {
                button.style.border = "1px solid #ffffff";
            }
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            // Restore the current theme color
            const currentAccentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
            button.style.backgroundColor = currentAccentColor;
            
            // Restore border for black theme
            if (currentAccentColor === "#000000") {
                button.style.border = "1px solid #ffffff";
            }
        });
    });
    
    // Helper functions
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
            case "AI Detector":
                return { ...base, detectAI: true };
            default:
                return base;
        }
    }
    
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
    
    async function handleTextTool(toolName) {
        let selectedText = window.getSelection().toString().trim();
        
        const allowFullPageFallback = !["Definition"].includes(toolName);
        
        if (!selectedText && allowFullPageFallback) {
            selectedText = document.body.innerText.trim();
            
            if (!selectedText) {
                showResult("No text found on this page.");
                return;
            }
        } else if (!selectedText) {
            showResult("Please select some text first.");
            return;
        }
        
        showResult(`Processing ${toolName}...`);
        
        try {
            const response = await fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildRequestBody(toolName, selectedText))
            });
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error("Server returned non-JSON response");
            }
            
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            
            const data = await response.json();
            const result = data.result || data.error || 'No response received from the server.';
            showResult(result);
            
        } catch (error) {
            console.error("Tool error:", error);
            let errorMessage = "Error: Could not process request.";
            
            if (error.message.includes("Failed to fetch")) {
                errorMessage = "Network error: Cannot connect to server.";
            } else if (error.message.includes("non-JSON response")) {
                errorMessage = "Server error: API server is not responding correctly.";
            }
            
            showResult(errorMessage + " Please try again.");
        }
    }
    
    async function handleImageUpload() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        
        fileInput.onchange = async () => {
            if (!fileInput.files || fileInput.files.length === 0) {
                return;
            }
            
            const file = fileInput.files[0];
            showResult("Uploading and processing image...");
            
            try {
                const formData = new FormData();
                formData.append('image', file);
                
                const response = await fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir", {
                    method: "POST",
                    body: formData
                });
                
                if (!response.ok) {
                    throw new Error(`Upload failed with status ${response.status}`);
                }
                
                const data = await response.json();
                let outputText = '';
                if (data.answers) {
                    outputText += 'ANSWERS:\n' + data.answers + '\n\n';
                }
                if (data.ocrText) {
                    outputText += 'EXTRACTED TEXT:\n' + data.ocrText;
                }
                if (!outputText) {
                    outputText = 'No response from server.';
                }
                showResult(outputText);
                
            } catch (error) {
                console.error("Image upload error:", error);
                showResult(`Error: ${error.message}`);
            }
        };
        
        document.body.appendChild(fileInput);
        fileInput.click();
        fileInput.remove();
    }
    
    function handleEnterPrompt() {
        showResult(`
            <div style="margin-bottom: 8px;">
                <textarea id="prompt-input" placeholder="Enter your prompt or question..." style="
                    width: 100%;
                    min-height: 60px;
                    padding: 6px 8px;
                    border: 1px solid rgba(66, 135, 245, 0.5);
                    background: rgba(42, 42, 42, 0.9);
                    color: #fff;
                    border-radius: 3px;
                    font-size: 12px;
                    font-family: Arial, sans-serif;
                    resize: vertical;
                    box-sizing: border-box;
                    margin-bottom: 6px;
                "></textarea>
                <div style="display: flex; gap: 4px;">
                    <button id="prompt-submit" style="
                        flex: 1;
                        padding: 4px 8px;
                        background: rgba(66, 135, 245, 0.8);
                        color: #fff;
                        border: none;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 12px;
                        font-family: Arial, sans-serif;
                    ">Generate</button>
                    <button id="prompt-cancel" style="
                        flex: 1;
                        padding: 4px 8px;
                        background: rgba(85, 85, 85, 0.8);
                        color: #fff;
                        border: none;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 12px;
                        font-family: Arial, sans-serif;
                    ">Cancel</button>
                </div>
            </div>
        `);
        
        const promptInput = document.getElementById('prompt-input');
        const promptSubmit = document.getElementById('prompt-submit');
        const promptCancel = document.getElementById('prompt-cancel');
        
        if (promptInput) promptInput.focus();
        
        if (promptSubmit) {
            promptSubmit.addEventListener('click', async () => {
                const prompt = promptInput.value.trim();
                if (!prompt) return;
                
                showResult("Processing prompt...");
                
                try {
                    const isMCQ = isMultipleChoiceQuestion(prompt);
                    const response = await fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            action: isMCQ ? 'Answer MCQ' : 'Essay Response',
                            text: prompt,
                            detailed: true
                        })
                    });
                    
                    const contentType = response.headers.get('content-type');
                    if (!contentType || !contentType.includes('application/json')) {
                        throw new Error("Server returned non-JSON response");
                    }
                    
                    if (!response.ok) {
                        throw new Error(`API request failed with status ${response.status}`);
                    }
                    
                    const data = await response.json();
                    const result = data.result || data.error || 'No response received from the server.';
                    showResult(result);
                    
                } catch (error) {
                    console.error("Prompt error:", error);
                    showResult(`Error: ${error.message}`);
                }
            });
        }
        
        if (promptCancel) {
            promptCancel.addEventListener('click', () => {
                bubbleResult.style.display = 'none';
            });
        }
        
        if (promptInput) {
            promptInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    promptSubmit.click();
                }
            });
        }
    }
    
    function handleBlinkPrompt() {
        showResult(`
            <div style="margin-bottom: 8px;">
                <div style="position: relative; width: 100%;">
                    <input type="text" id="blink-input" placeholder="Blink: Ask for a quick answer..." style="
                        width: 100%;
                        height: 26px;
                        padding: 4px 30px 4px 10px;
                        border: 2px solid #444;
                        background-color: #333;
                        color: #fff;
                        font-size: 12px;
                        letter-spacing: 1px;
                        border-radius: 4px;
                        box-sizing: border-box;
                        transition: border 0.2s linear, box-shadow 0.2s linear;
                    ">
                    <span style="
                        position: absolute;
                        right: 8px;
                        top: 50%;
                        transform: translateY(-50%);
                        cursor: pointer;
                    " id="blink-submit-icon">⚡</span>
                </div>
            </div>
        `);
        
        const blinkInput = document.getElementById('blink-input');
        const blinkSubmitIcon = document.getElementById('blink-submit-icon');
        
        if (blinkInput) blinkInput.focus();
        
        const submitBlink = async () => {
            const question = blinkInput.value.trim();
            if (!question) return;
            
            showResult("Processing Blink question...");
            
            try {
                const response = await fetch("https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "Blink",
                        text: question,
                        maxWords: 25,
                        concise: true
                    })
                });
                
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error("Server returned non-JSON response");
                }
                
                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }
                
                const data = await response.json();
                let resultText = '';
                if (data.result) {
                    resultText = data.result;
                } else if (data.error) {
                    resultText = `Error: ${data.error}`;
                } else {
                    resultText = 'No answer found.';
                }
                
                showResult(resultText);
                
            } catch (error) {
                console.error("Blink error:", error);
                showResult(`Error: ${error.message}`);
            }
        };
        
        if (blinkSubmitIcon) {
            blinkSubmitIcon.addEventListener('click', submitBlink);
        }
        
        if (blinkInput) {
            blinkInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    submitBlink();
                }
            });
            
            blinkInput.addEventListener('focus', () => {
                blinkInput.style.border = '0.5px solid #4287f5';
                blinkInput.style.boxShadow = '-3px -3px 0px #4287f5';
                blinkInput.style.outline = 'none';
            });
            
            blinkInput.addEventListener('blur', () => {
                blinkInput.style.border = '2px solid #444';
                blinkInput.style.boxShadow = 'none';
            });
        }
    }
    
    function showResult(content, title = "Mimir Result") {
        // Create popup overlay if it doesn't exist
        let resultPopup = document.getElementById('bubble-result-popup');
        if (!resultPopup) {
            createResultPopup();
            resultPopup = document.getElementById('bubble-result-popup');
        }
        
        const resultHeader = document.getElementById('bubble-result-header');
        const resultText = document.getElementById('bubble-result-text');
        
        resultHeader.textContent = title;
        resultText.textContent = content;
        resultPopup.style.display = 'flex';
    }
    
    function createResultPopup() {
        const resultPopup = document.createElement('div');
        resultPopup.id = 'bubble-result-popup';
        resultPopup.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 1000000;
            display: none;
            justify-content: center;
            align-items: center;
            padding: 20px;
            box-sizing: border-box;
            animation: bubbleResultPopupFadeIn 0.3s ease-out;
        `;
        
        const currentAccentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color') || '#4287f5';
        
        resultPopup.innerHTML = `
            <div style="
                background: #2a2a2a;
                border: 2px solid ${currentAccentColor};
                border-radius: 15px;
                max-width: 500px;
                max-height: 80vh;
                width: 100%;
                position: relative;
                display: flex;
                flex-direction: column;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                animation: bubbleResultPopupSlideIn 0.3s ease-out;
            " id="bubble-result-popup-content">
                <button style="
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    background: none;
                    border: none;
                    font-size: 24px;
                    color: #999;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    transition: color 0.2s ease;
                    z-index: 10;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                " id="bubble-result-close">&times;</button>
                
                <div style="
                    font-size: 20px;
                    font-weight: bold;
                    color: ${currentAccentColor};
                    padding: 20px 50px 15px 20px;
                    font-family: Arial, sans-serif;
                    border-bottom: 1px solid rgba(66, 135, 245, 0.3);
                    flex-shrink: 0;
                " id="bubble-result-header">Mimir Result</div>
                
                <div style="
                    padding: 20px;
                    color: #fff;
                    font-family: sans-serif;
                    font-size: 14px;
                    line-height: 1.5;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    overflow-y: auto;
                    flex: 1;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(66, 135, 245, 0.6) rgba(42, 42, 42, 0.3);
                " id="bubble-result-text"></div>
            </div>
            
            <style>
                @keyframes bubbleResultPopupFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes bubbleResultPopupSlideIn {
                    from {
                        transform: scale(0.8) translateY(-20px);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1) translateY(0);
                        opacity: 1;
                    }
                }
                
                #bubble-result-text::-webkit-scrollbar {
                    width: 8px;
                }
                
                #bubble-result-text::-webkit-scrollbar-track {
                    background: rgba(42, 42, 42, 0.3);
                    border-radius: 4px;
                }
                
                #bubble-result-text::-webkit-scrollbar-thumb {
                    background: rgba(66, 135, 245, 0.6);
                    border-radius: 4px;
                }
                
                #bubble-result-text::-webkit-scrollbar-thumb:hover {
                    background: rgba(66, 135, 245, 0.8);
                }
            </style>
        `;
        
        document.body.appendChild(resultPopup);
        
        // Add event listeners
        const resultCloseBtn = document.getElementById('bubble-result-close');
        resultCloseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resultPopup.style.display = 'none';
        });
        
        resultCloseBtn.addEventListener('mouseenter', () => {
            resultCloseBtn.style.color = '#fff';
        });
        
        resultCloseBtn.addEventListener('mouseleave', () => {
            resultCloseBtn.style.color = '#999';
        });
        
        // Close when clicking outside
        resultPopup.addEventListener('click', (e) => {
            if (e.target === resultPopup) {
                resultPopup.style.display = 'none';
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && resultPopup.style.display === 'flex') {
                resultPopup.style.display = 'none';
            }
        });
    }
    
    // Function to show bubble
    function showBubble() {
        bubbleContainer.style.display = 'block';
    }
    
    // Function to hide bubble
    function hideBubble() {
        bubbleContainer.style.display = 'none';
    }
    
    // Initialize bubble as visible for testing
    showBubble();
    bubbleContainer.style.cursor = 'grab';
});
