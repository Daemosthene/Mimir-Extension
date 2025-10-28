const themeColors = {
  default: "#4287f5",
  red:    "#A4262C",
  orange: "#CA5010",
  darkblue: "#40587C",
  green:  "#407855",
  purple: "#8764B8",
  teal:   "#038387",
  yellow: "#CEA230",
  white:  "#ffffff",
  black:  "#000000"
};

document.addEventListener("DOMContentLoaded", () => {
  const dailyBriefToggle = document.getElementById("dailyBriefToggle");
  const dailyArrow = document.getElementById("arrow-brief");
  const dailyDesc = document.getElementById("desc-brief");

  const themeSetting = document.getElementById("themeSetting");
  const themeSelector = document.getElementById("themeSelector");

  chrome.storage.local.get(["isProUser", "theme"], (data) => {
    // Always treat as Pro
    // Remove all pro-only disabling logic

    // Remove click handlers for pro-only features

    // Show theme setting
    const themeSetting = document.getElementById("themeSetting");
    themeSetting.style.display = "block";

    // Initialize selector value from storage
    if (data.theme) {
      themeSelector.value = data.theme;
    }

    // Apply the current or default theme
    const initialTheme = data.theme || "default";
    applyThemeColor(initialTheme);

    // Listen for theme changes
    themeSelector.addEventListener("change", () => {
      const newTheme = themeSelector.value;
      chrome.storage.local.set({ theme: newTheme }, () => {
        applyThemeColor(newTheme);
        chrome.runtime.sendMessage({ type: "themeChanged", theme: newTheme });
        chrome.runtime.sendMessage({ type: "setIconByTheme", theme: newTheme });
      });
    });
  });
});

function applyThemeColor(themeKey) {
  const color = themeColors[themeKey] || themeColors.default; // fallback to blue
  document.documentElement.style.setProperty("--accent-color", color);
  
  // For white and black themes, keep text WHITE (not the theme color)
  if (color === "#ffffff" || color === "#000000") {
    const textElements = document.querySelectorAll('.settings-title, .label');
    textElements.forEach(element => {
      element.style.color = '#ffffff';
    });
  } else {
    const textElements = document.querySelectorAll('.settings-title, .label');
    textElements.forEach(element => {
      element.style.color = color;
    });
  }
}

function showMiniPopup(targetEl, message) {
  const existing = document.querySelector(".mimir-mini-popup");
  if (existing) existing.remove();

  const popup = document.createElement("div");
  popup.textContent = message;
  popup.className = "mimir-mini-popup";

  const rect = targetEl.getBoundingClientRect();
  popup.style.position = "fixed";
  popup.style.top = `${rect.top + rect.height / 2 - 12}px`; // center vertically
  popup.style.left = `${rect.left - 210}px`; // 200px width + padding
  popup.style.background = "#333";
  popup.style.color = "#fff";
  popup.style.padding = "6px 10px";
  popup.style.fontSize = "12px";
  popup.style.borderRadius = "4px";
  popup.style.zIndex = 999999;
  popup.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  popup.style.whiteSpace = "nowrap";
  popup.style.maxWidth = "200px";

  document.body.appendChild(popup);

  setTimeout(() => popup.remove(), 2000);
}