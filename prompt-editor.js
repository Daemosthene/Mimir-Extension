// Prompt Editor JavaScript

// Global variable to store the current response text
let currentResponseText = "";

// Initialize the editor when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Ensure the DOM is fully loaded before accessing elements
  initializeEditor();
});

function initializeEditor() {
  console.log("Initializing editor...");
  
  // Set up event handlers
  const editor = document.getElementById('editor');
  const promptInput = document.getElementById('promptInput');
  const generateBtn = document.getElementById('generateBtn');
  const humanizeBtn = document.getElementById('humanizeBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const copyBtn = document.getElementById('copyBtn');
  
  // Generate button functionality
  if (generateBtn) {
    console.log("Adding event listener to generateBtn");
    generateBtn.addEventListener('click', function() {
      const prompt = promptInput.value.trim();
      if (prompt) {
        generateResponse(prompt);
      } else {
        alert("Please enter a prompt first.");
      }
    });
  } else {
    console.error("Generate button not found");
  }
  
  // Humanize button functionality
  if (humanizeBtn) {
    console.log("Adding event listener to humanizeBtn");
    humanizeBtn.addEventListener('click', function() {
      humanizeCurrentText();
    });
  } else {
    console.error("Humanize button not found");
  }
  
  // Copy button functionality
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      copyToClipboard();
    });
  }
  
  // Download button functionality
  if (downloadBtn) {
    downloadBtn.addEventListener('click', function() {
      exportToWord();
    });
  }
  
  // Initialize toolbar buttons
  setupToolbar();
}

// Set up the text formatting toolbar
function setupToolbar() {
  // Text formatting buttons
  const boldBtn = document.getElementById('boldBtn');
  const italicBtn = document.getElementById('italicBtn');
  const underlineBtn = document.getElementById('underlineBtn');
  
  // Alignment buttons
  const alignLeftBtn = document.getElementById('alignLeftBtn');
  const alignCenterBtn = document.getElementById('alignCenterBtn');
  const alignRightBtn = document.getElementById('alignRightBtn');
  const justifyBtn = document.getElementById('justifyBtn');
  
  // Line spacing dropdown
  const lineSpacing = document.getElementById('lineSpacing');
  
  // Add event listeners for formatting buttons
  if (boldBtn) boldBtn.addEventListener('click', () => formatText('bold'));
  if (italicBtn) italicBtn.addEventListener('click', () => formatText('italic'));
  if (underlineBtn) underlineBtn.addEventListener('click', () => formatText('underline'));
  
  // Add event listeners for alignment buttons
  if (alignLeftBtn) alignLeftBtn.addEventListener('click', () => setAlignment('left'));
  if (alignCenterBtn) alignCenterBtn.addEventListener('click', () => setAlignment('center'));
  if (alignRightBtn) alignRightBtn.addEventListener('click', () => setAlignment('right'));
  if (justifyBtn) justifyBtn.addEventListener('click', () => setAlignment('justify'));
  
  // Add event listener for line spacing
  if (lineSpacing) {
    lineSpacing.addEventListener('change', function() {
      setLineSpacing(this.value);
    });
  }
}

// Apply formatting to selected text
function formatText(format) {
  const editor = document.getElementById('editor');
  document.execCommand(format, false);
  editor.focus();
}

// Apply alignment to selected text or paragraph
function setAlignment(alignment) {
  const editor = document.getElementById('editor');
  document.execCommand(`justify${alignment}`, false);
  editor.focus();
}

// Set line spacing for selected text
function setLineSpacing(spacing) {
  const editor = document.getElementById('editor');
  const selection = window.getSelection();
  
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const selectedNodes = getNodesInRange(range);
    
    selectedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        node.style.lineHeight = spacing;
      } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
        node.parentElement.style.lineHeight = spacing;
      }
    });
  } else {
    // If no text is selected, apply to the whole editor
    editor.style.lineHeight = spacing;
  }
  
  editor.focus();
}

// Get all nodes within a range
function getNodesInRange(range) {
  const nodes = [];
  const endNode = range.endContainer;
  let startNode = range.startContainer;
  
  // Simple case: same container
  if (startNode === endNode) {
    nodes.push(startNode);
    return nodes;
  }
  
  // Complex case: different containers
  let currentNode = startNode;
  
  while (currentNode && currentNode !== endNode) {
    nodes.push(currentNode);
    
    if (currentNode.childNodes.length > 0) {
      currentNode = currentNode.firstChild;
    } else if (currentNode.nextSibling) {
      currentNode = currentNode.nextSibling;
    } else {
      // Go up and to the next sibling
      let parent = currentNode.parentNode;
      while (parent && !parent.nextSibling) {
        parent = parent.parentNode;
      }
      
      if (!parent) break;
      currentNode = parent.nextSibling;
    }
  }
  
  // Add the end node
  nodes.push(endNode);
  
  return nodes;
}

// Generate AI response based on the prompt
async function generateResponse(prompt) {
  const editor = document.getElementById('editor');
  const loadingMsg = document.getElementById('loadingMessage');
  const statusMsg = document.getElementById('statusMessage');

  if (loadingMsg) loadingMsg.style.display = 'block';
  if (statusMsg) statusMsg.textContent = 'Generating response...';

  try {
    // Use deployed backend URL to comply with CSP
    const response = await fetch('https://mimir-server-daemosthene-mimir-extension.vercel.app/api/mimir', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'Generate Essay',
        text: prompt
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate response');
    }

    const data = await response.json();

    // Store the response for potential humanization later
    currentResponseText = data.result || '';

    // Display the response
    editor.innerHTML = currentResponseText;
    if (statusMsg) statusMsg.textContent = 'Response generated successfully';
  } catch (error) {
    console.error("Error generating response:", error);
    editor.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    if (statusMsg) statusMsg.textContent = `Error: ${error.message}`;
  } finally {
    if (loadingMsg) loadingMsg.style.display = 'none';
  }
}

// Humanize the current text using the AcademicTextHumanizer
function humanizeCurrentText() {
  console.log("Humanizing text...");
  const editor = document.getElementById('editor');
  const statusMsg = document.getElementById('statusMessage');
  const humanizeStatus = document.getElementById('humanizeStatus');
  
  // Get the current text from the editor
  const editorContent = editor.innerHTML;
  
  if (!editorContent || editorContent.trim() === '') {
    if (statusMsg) statusMsg.textContent = "No text to humanize. Generate a response first.";
    return;
  }
  
  try {
    // Show status message
    if (humanizeStatus) {
      humanizeStatus.textContent = "Humanizing text...";
      humanizeStatus.style.display = "block";
    }
    
    // Extract plain text from HTML content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editorContent;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";
    
    console.log("Original text:", plainText);
    
    // Check if AcademicTextHumanizer is available
    if (typeof window.AcademicTextHumanizer === 'undefined') {
      console.error("AcademicTextHumanizer is not defined");
      if (statusMsg) statusMsg.textContent = "Error: Humanizer not available";
      return;
    }
    
    // Create an instance of the humanizer with optimized settings
    const humanizer = new window.AcademicTextHumanizer({
      p_passive: 0.35,           // Higher chance of passive voice changes
      p_synonym_replacement: 0.4, // Decent amount of synonym replacements
      p_academic_transition: 0.45 // Good chance to add academic transitions
    });
    
    // Humanize the text with all options enabled
    const humanizedText = humanizer.humanizeText(
      plainText,
      true,  // Use passive voice
      true   // Use synonyms
    );
    
    console.log("Humanized text:", humanizedText);
    
    // Update the editor with humanized text
    editor.innerText = humanizedText;
    
    // Show success message
    if (statusMsg) statusMsg.textContent = "Text humanized successfully";
    if (humanizeStatus) {
      humanizeStatus.textContent = "✓ Text has been humanized to appear less AI-generated";
      humanizeStatus.style.color = "#4CAF50";
      
      // Hide the message after 3 seconds
      setTimeout(() => {
        humanizeStatus.style.display = "none";
      }, 3000);
    }
  } catch (error) {
    console.error("Error humanizing text:", error);
    if (statusMsg) statusMsg.textContent = "Failed to humanize text: " + error.message;
  }
}

// Copy text to clipboard
function copyToClipboard() {
  const editor = document.getElementById('editor');
  const statusMsg = document.getElementById('statusMessage');
  const text = editor.innerText || editor.textContent;
  
  navigator.clipboard.writeText(text)
    .then(() => {
      if (statusMsg) statusMsg.textContent = "Text copied to clipboard!";
    })
    .catch(err => {
      console.error('Failed to copy text:', err);
      if (statusMsg) statusMsg.textContent = "Failed to copy text. Please try again or copy manually.";
    });
}

// Export to Word document
function exportToWord() {
  const editor = document.getElementById('editor');
  const statusMsg = document.getElementById('statusMessage');
  const content = editor.innerHTML;
  
  // Create a simple HTML document with the content
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Mimir Export</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.5; }
      </style>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `;
  
  // Create a Blob with the HTML content
  const blob = new Blob([html], { type: 'application/msword' });
  
  // Create a download link and trigger a click
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'mimir-export.doc';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  if (statusMsg) statusMsg.textContent = "Document exported successfully";
}

// Add console logging for debugging
console.log("Prompt editor script loaded");
