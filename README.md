# Mimir v3.0.0 - AI-Powered Browser Extension

Mimir is a minimally invasive intuitive browser extension that provides AI-powered tools for analyzing text, summarizing, translating, and increasing your productivity directly in your browser.

## Features

### Core AI Tools
- **Summarize** - Generate concise summaries of selected text or entire pages
- **Explain Like I'm 5** - Simplify complex content into easy-to-understand explanations
- **Translate Text** - Translate content between multiple languages
- **Definition** - Get detailed definitions and explanations of terms
- **Citation Finder** - Automatically generate proper citations for content
- **Turn Professional** - Enhance writing tone and style for professional contexts

### Advanced Features (Pro)
- **Socratic Review** - Interactive questioning to deepen understanding
- **Daily Brief** - Personalized content summaries and insights
- **Flashcard Generator** - Create study materials from any text
- **Upload Image** - Analyze and extract text from images
- **Enter Prompt** - Custom AI interactions with your own prompts
- **Blink** - Quick text analysis and insights

### intelligent Features
- **Context Menu Integration** - Right-click on any text to access tools
- **Sidebar Interface** - Clean, integrated workspace within any webpage
- **Theme Customization** - Multiple color themes (default, red, orange, darkblue, green, purple, teal, yellow, black, white)
- **Text Humanization** - Convert AI-generated text to more natural language
- **Prompt Editor** - Customize and manage AI prompts

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The Mimir extension icon will appear in your toolbar

## Usage

### Basic Usage
1. **Select Text**: Highlight any text on a webpage
2. **Right-click**: Choose from available Mimir tools in the context menu
3. **View Results**: The sidebar will open with AI-generated results

### Popup Interface
- Click the Mimir icon in your toolbar to access:
  - Quick tool selection
  - Settings and preferences
  - Pro upgrade options
  - Theme selection

## Pro Features

Mimir offers both free and Pro tiers:

### Free Tier
- Unlimited access to: Summarize, Explain Like I'm 5, Translate Text
- Basic functionality for all core features

### Pro Tier
- Unlimited access to all advanced tools
- Enhanced processing capabilities
- Priority support
- Regular feature updates

**Upgrade to Pro** through the extension popup for full access to all features.

## Customization

### Themes
Choose from 10 themes to suit your style:
- Default (Blue)
- Red
- Orange
- Dark Blue
- Green
- Purple
- Teal
- Yellow
- black
- white

### Settings
- Customize prompt templates
- Adjust processing preferences
- Manage tool availability
- Configure display options

## Technical Details

### Architecture
- **Manifest V3** compatible
- **Background Service Worker** for API handling
- **Content Scripts** for webpage integration
- **Popup Interface** for quick access
- **Local Storage** for settings and preferences

### Dependencies
- **Compromise.js** - Natural language processing
- **Compromise Sentences** - Advanced sentence analysis
- Custom AI processing pipeline

### File Structure
```