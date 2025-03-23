# Highlight Extractor

A browser extension that extracts highlighted text from web pages and automatically converts them to flashcards.

## Overview

This extension is designed for students, researchers, and readers who want to efficiently convert highlighted text into study materials. It works with Microsoft Edge and Chrome browsers.

## Features

- **Extract Highlights**: Automatically detects and extracts highlighted text from web pages
- **Flashcard Creation**: Converts highlights into flashcard format with customizable options
- **Multiple Export Formats**: Export your flashcards in TXT, CSV, JSON, or Anki-compatible format
- **Auto-Title Generation**: Automatically generates titles for your flashcards based on content
- **Question Format**: Optionally format your highlights as questions for better study retention
- **PDF Support**: Works with Microsoft Edge's PDF viewer

## Installation in Microsoft Edge

Since Microsoft Edge is built on Chromium, it can run Chrome extensions. To install:

1. Download or clone this repository to your computer
2. Open Microsoft Edge and navigate to `edge://extensions/`
3. Enable "Developer mode" using the toggle in the bottom-left corner
4. Click "Load unpacked" and select the folder containing the extension files
5. The extension icon should appear in your browser toolbar

## How to Use

1. Browse to a page with text you want to extract (like the book you're reading)
2. Highlight important text using your browser's highlighting feature
3. Click the extension icon in your toolbar
4. Press the "Extract Highlights" button
5. View your extracted highlights in the "Flashcards" tab
6. Export your flashcards using the "Export" button

## Customization

In the Settings tab, you can:
- Enable auto-extraction of highlights when you visit a page
- Choose whether to auto-generate titles
- Format highlights as questions
- Select your preferred export format

## Troubleshooting

If highlights aren't being detected:
- Make sure you're using the browser's built-in highlight feature or a compatible reader
- For PDFs, ensure you're using Microsoft Edge's PDF viewer
- Try refreshing the page and re-highlighting the text

## Notes for Microsoft Edge

This extension is fully compatible with Microsoft Edge as it's built using the standard Chrome extension API that Edge supports. When using with Edge's PDF viewer, the extension specifically targets the highlighting elements used by Edge.
