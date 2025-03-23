// background.js - Background script for the extension

// Initialize default settings when extension is installed
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === "install") {
    const defaultSettings = {
      autoTitle: true,
      autoQuestion: false,
      exportFormat: 'txt',
      highlightColor: '#ffeb3b' // Default yellow highlight color
    };
    
    chrome.storage.sync.set({ settings: defaultSettings });
    chrome.storage.local.set({ 
      flashcards: [],
      highlights: {} // Storage for page highlights
    });

    console.log("Highlight Extractor installed with default settings");
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Handle extraction requests from content script
  if (request.action === "extractHighlights") {
    console.log("Background received extract request");
    // Forward the message to the active tab's content script
    if (sender.tab) {
      chrome.tabs.sendMessage(sender.tab.id, {action: "extractHighlights"}, function(response) {
        sendResponse(response);
      });
      return true; // Keep the message channel open for async response
    }
  }
  
  // Handle highlight selection requests
  if (request.action === "highlightSelection") {
    console.log("Background received highlight request");
    if (sender.tab) {
      // Forward to the content script
      chrome.tabs.sendMessage(sender.tab.id, {
        action: "highlightSelection", 
        color: request.color
      }, function(response) {
        sendResponse(response);
      });
      return true;
    }
  }
  
  // For direct saving of highlights from content script
  if (request.action === "saveHighlight") {
    saveHighlightToStorage(request.highlight, sender.tab?.url);
    sendResponse({success: true});
    return true;
  }
  
  // Handle saveHighlights action
  if (request.action === "saveHighlights") {
    saveHighlightsToStorage(request.highlights);
    return true;
  }
});

// Save highlights to storage
function saveHighlightsToStorage(highlights) {
  chrome.storage.local.get(['flashcards'], function(result) {
    let flashcards = result.flashcards || [];
    
    // Process the highlights into flashcards
    chrome.storage.sync.get(['settings'], function(settingsResult) {
      const settings = settingsResult.settings || {};
      
      const processedHighlights = processHighlightsToFlashcards(highlights, settings);
      
      // Add the new flashcards
      flashcards.push(...processedHighlights);
      
      // Save updated flashcards
      chrome.storage.local.set({ flashcards: flashcards });
    });
  });
}

// Save a single highlight to storage
function saveHighlightToStorage(highlight, url) {
  if (!url) return;
  
  const urlKey = encodeURIComponent(url);
  
  chrome.storage.local.get(['highlights'], function(result) {
    let allHighlights = result.highlights || {};
    let pageHighlights = allHighlights[urlKey] || [];
    
    // Add the new highlight
    pageHighlights.push(highlight);
    
    // Update storage
    allHighlights[urlKey] = pageHighlights;
    chrome.storage.local.set({ highlights: allHighlights }, function() {
      console.log('Highlight saved for: ' + url);
    });
  });
}

// Process highlights into flashcards
function processHighlightsToFlashcards(highlights, settings) {
  return highlights.map(highlight => {
    let title = '';
    if (settings.autoTitle) {
      // Use first 5 words as title
      const words = highlight.text.split(' ');
      title = words.slice(0, 5).join(' ');
      if (words.length > 5) title += '...';
    }
    
    let content = highlight.text;
    if (settings.autoQuestion) {
      // Format as a question
      content = `What does this mean: "${highlight.text}"?`;
    }
    
    return {
      title: title,
      content: content,
      originalText: highlight.text,
      context: highlight.context || '',
      timestamp: highlight.timestamp,
      color: highlight.color,
      source: highlight.url
    };
  });
}
