// background.js - Background script for the extension

// Initialize default settings when extension is installed
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === "install") {
    const defaultSettings = {
      autoTitle: true,
      autoQuestion: false,
      exportFormat: 'txt',
      highlightColor: '#ffeb3b', // Default yellow highlight color
      improvePdf: true          // Enable PDF support by default
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
      chrome.tabs.sendMessage(sender.tab.id, {
        action: "extractHighlights",
        source: request.source // Forward the source information
      }, function(response) {
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
        color: request.color,
        source: request.source // Forward the source information
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
  
  // Handle PDF selection
  if (request.action === "pdfSelection") {
    console.log("Background received PDF selection");
    // Save the PDF selection as a highlight
    const highlight = {
      id: 'pdf-highlight-' + Date.now(),
      text: request.text,
      color: '#ffeb3b', // Default yellow for PDF highlights
      context: '',
      timestamp: new Date().toISOString(),
      url: request.url || sender.tab?.url,
      title: request.title || sender.tab?.title,
      source: request.source || '',
      isPdf: true
    };
    
    // Save the highlight
    saveHighlightToStorage(highlight, highlight.url);
    
    // Also add it as a flashcard
    addFlashcardFromHighlight(highlight);
    
    sendResponse({success: true});
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

// Add a flashcard from a highlight
function addFlashcardFromHighlight(highlight) {
  chrome.storage.local.get(['flashcards'], function(result) {
    let flashcards = result.flashcards || [];
    
    // Get settings for processing
    chrome.storage.sync.get(['settings'], function(settingsResult) {
      const settings = settingsResult.settings || {};
      
      // Generate title based on settings
      let title = '';
      if (settings.autoTitle !== false) { // Default to true
        // Use first 5 words as title
        const words = highlight.text.split(' ');
        title = words.slice(0, 5).join(' ');
        if (words.length > 5) title += '...';
      }
      
      // Generate content based on settings
      let content = highlight.text;
      if (settings.autoQuestion === true) { // Default to false
        // Format as a question
        content = `What does this mean: "${highlight.text}"?`;
      }
      
      // Create flashcard
      const flashcard = {
        title: title,
        content: content,
        originalText: highlight.text,
        context: highlight.context || '',
        color: highlight.color,
        url: highlight.url,
        pageTitle: highlight.title,
        timestamp: highlight.timestamp,
        source: highlight.source || '',
        isPdf: highlight.isPdf || false
      };
      
      // Add to flashcards and save
      flashcards.push(flashcard);
      chrome.storage.local.set({ flashcards: flashcards }, function() {
        console.log('Flashcard added from highlight');
      });
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
      timestamp: highlight.timestamp || new Date().toISOString(),
      color: highlight.color,
      url: highlight.url || '',
      pageTitle: highlight.title || '',
      source: highlight.source || highlight.url || ''
    };
  });
}
