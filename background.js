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
      
      // We'll only process highlights that don't already exist in flashcards
      // Check only by text content for simplicity and consistency
      const newHighlights = highlights.filter(highlight => {
        return !flashcards.some(card => 
          card.originalText === highlight.text
        );
      });
      
      if (newHighlights.length === 0) {
        console.log('No new highlights to save to storage');
        return;
      }
      
      console.log(`Processing ${newHighlights.length} new highlights out of ${highlights.length} total`);
      
      const processedHighlights = [];
      
      // Process each highlight
      newHighlights.forEach(highlight => {
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
        
        processedHighlights.push({
          title: title,
          content: content,
          originalText: highlight.text,
          context: highlight.context || '',
          timestamp: highlight.timestamp || new Date().toISOString(),
          color: highlight.color,
          url: highlight.url || '',
          pageTitle: highlight.title || '',
          source: highlight.source || highlight.url || ''
        });
      });
      
      // Add the new flashcards
      flashcards.push(...processedHighlights);
      
      // Save updated flashcards
      chrome.storage.local.set({ flashcards: flashcards }, function() {
        console.log(`Saved ${processedHighlights.length} new flashcards`);
      });
    });
  });
}

// Add a flashcard from a highlight
function addFlashcardFromHighlight(highlight) {
  chrome.storage.local.get(['flashcards'], function(result) {
    let flashcards = result.flashcards || [];
    
    // Check for duplicates before adding - only check text content
    const isDuplicate = flashcards.some(card => 
      card.originalText === highlight.text
    );
    
    if (isDuplicate) {
      console.log('Duplicate flashcard detected in background script, not adding:', highlight.text);
      return;
    }
    
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