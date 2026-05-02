# Scribe Clone

A browser extension for Chrome that allows you to record a sequence of user actions and automatically generate a step-by-step user guide with screenshots.

## Features

- **Action Recording**: Captures clicks and interactions in real-time.
- **Automatic Descriptions**: Generates human-readable descriptions for each captured event.
- **Visual Guides**: Creates a clean HTML guide with screenshots and click indicators.
- **Customization**: 
  - Edit step descriptions directly in the exported guide.
  - Reorder steps using "Move Up" and "Move Down" buttons.
  - Delete unwanted steps from the guide and underlying storage.
  - Redaction mode to hide sensitive information in screenshots.
- **Multiple Export Formats**: Export as HTML or Markdown.

## Installation

1. Clone this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the project folder.

## How it Works

- **Background Script**: Manages the recording state and persists events to `chrome.storage.local`.
- **Content Script**: Listens for user events on the page and sends them to the background script.
- **Popup**: Provides the user interface to start/stop recording and export the final guide.

## Acknowledgments

Built with the assistance of Claude and Ollama.
