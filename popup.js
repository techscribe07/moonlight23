document.addEventListener('DOMContentLoaded', function() {
  // Tab switching functionality
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // Load saved flashcards
  loadFlashcards();
  
  // Load saved settings
  loadSettings();
  
  // Extract Highlights button
  document.getElementById('extractBtn').addEventListener('click', function() {
    extractHighlights();
  });
  
  // Add Highlight button
  document.getElementById('addHighlightBtn').addEventListener('click', function() {
    addHighlight();
  });
  
  // Export button
  document.getElementById('exportBtn').addEventListener('click', function() {
    exportFlashcards();
  });
  
  // Clear button
  document.getElementById('clearBtn').addEventListener('click', function() {
    clearFlashcards();
  });
  
  // Save settings button
  document.getElementById('saveSettings').addEventListener('click', function() {
    saveSettings();
  });
  
  // Clear Highlights button
  document.getElementById('clearHighlightsBtn').addEventListener('click', function() {
    clearHighlights();
  });
  
  // View Notes button
  document.getElementById('viewNotesBtn').addEventListener('click', function() {
    openNotesPage();
  });
  
  // Check if we're in a PDF on popup open
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const isPdf = tabs[0].url.toLowerCase().includes('.pdf');
    if (isPdf) {
      // For PDFs, show a special notice
      const statusElement = document.getElementById('extraction-status');
      statusElement.innerHTML = '<strong>PDF Detected:</strong> Select text and click Highlight!';
      
      // Check if enhanced PDF support is enabled
      chrome.storage.sync.get(['settings'], function(result) {
        const settings = result.settings || {};
        if (settings.improvePdf) {
          // Inject PDF enhancement script
          enhancePdfSupport(tabs[0].id);
        }
      });
    }
  });
  
  // Theme toggle functionality
  document.getElementById('themeToggle').addEventListener('click', function() {
    document.body.classList.toggle('dark-theme');
    
    // Save theme preference
    chrome.storage.sync.get(['settings'], function(result) {
      const settings = result.settings || {};
      settings.darkMode = document.body.classList.contains('dark-theme');
      chrome.storage.sync.set({ settings: settings });
    });
  });
});

// Function to highlight selected text in the active tab
function addHighlight() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    // Get the highlight color from settings or use default
    chrome.storage.sync.get(['settings'], function(result) {
      const settings = result.settings || {};
      const highlightColor = settings.highlightColor || '#ffeb3b'; // Default yellow
      
      // Get source info if available
      const sourceInput = document.getElementById('source-input');
      const source = sourceInput ? sourceInput.value.trim() : '';
      
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: (color, source) => {
          // Send a message to the content script to highlight the selection
          chrome.runtime.sendMessage({
            action: "highlightSelection",
            color: color,
            source: source
          });
        },
        args: [highlightColor, source]
      });
    });
  });
}

// Function to extract highlights from the active tab
function extractHighlights() {
  // Show loading indicator
  document.getElementById('extraction-status').textContent = "Extracting highlights...";
  
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    // Get source info if available
    const sourceInput = document.getElementById('source-input');
    const source = sourceInput ? sourceInput.value.trim() : '';
    
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      function: (source) => {
        // This function runs in the context of the web page
        return chrome.runtime.sendMessage({
          action: "extractHighlights",
          source: source
        });
      },
      args: [source]
    }, (results) => {
      if (chrome.runtime.lastError) {
        document.getElementById('extraction-status').textContent = 
          "Error: " + chrome.runtime.lastError.message;
        return;
      }
      
      // Check if we got valid results
      if (!results || results.length === 0) {
        document.getElementById('extraction-status').textContent = 
          "No highlights found. Try selecting text and clicking 'Highlight' first.";
        return;
      }
      
      // Process extracted highlights
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "extractHighlights",
        source: source
      }, function(response) {
        if (chrome.runtime.lastError) {
          document.getElementById('extraction-status').textContent = 
            "Error communicating with page. Please try again.";
          return;
        }
        
        if (!response || !response.highlights || response.highlights.length === 0) {
          document.getElementById('extraction-status').textContent = 
            "No highlights found. Try selecting text and clicking 'Highlight' first.";
          return;
        }
        
        // Save the highlights
        saveHighlights(response.highlights);
        
        // Update status
        document.getElementById('extraction-status').textContent = 
          `Extracted ${response.highlights.length} highlight(s)!`;
      });
    });
  });
}

// Function to clear all highlights from the active tab
function clearHighlights() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {action: "clearHighlights"}, function(response) {
      if (chrome.runtime.lastError || !response || !response.success) {
        document.getElementById('extraction-status').textContent = 
          "Error clearing highlights. Please try again.";
        return;
      }
      
      document.getElementById('extraction-status').textContent = "Highlights cleared!";
    });
  });
}

// Save highlights to storage
function saveHighlights(highlights) {
  // Get existing flashcards first
  chrome.storage.local.get(['flashcards'], function(result) {
    let flashcards = result.flashcards || [];
    
    // Get source info if available
    const sourceInput = document.getElementById('source-input');
    const sourceValue = sourceInput ? sourceInput.value.trim() : '';
    
    // Array to track new flashcards added
    const newFlashcards = [];
    
    // Process new highlights
    highlights.forEach(highlight => {
      // Skip system messages
      if (highlight.isCanvasWarning || highlight.isLatexWarning) {
        return;
      }
      
      // Skip if the highlight text is empty
      if (!highlight.text || highlight.text.trim() === '') {
        return;
      }
      
      // Generate title based on first few words or context
      const autoTitle = document.getElementById('auto-title').checked;
      const asQuestion = document.getElementById('auto-question').checked;
      
      let title = '';
      if (autoTitle) {
        // Use first 5 words as title
        const words = highlight.text.split(' ');
        title = words.slice(0, 5).join(' ');
        if (words.length > 5) title += '...';
      }
      
      let content = highlight.text;
      if (asQuestion) {
        // Format as a question by adding "What is" or similar prefix
        content = `What does this mean: "${highlight.text}"?`;
      }
      
      // Use highlight source if available, otherwise use the source input field
      const source = highlight.source || sourceValue;
      
      // Use a more flexible approach for duplicate detection
      const highlightUrl = highlight.url || window.location.href;
      
      // Less strict duplicate detection - just check if the text matches 
      // (don't check URL to avoid issues with URL encoding/formatting)
      const isDuplicate = flashcards.some(card => 
        card.originalText === highlight.text
      );
      
      if (isDuplicate) {
        console.log('Duplicate flashcard detected, not adding:', highlight.text);
        return;
      }
      
      // Create the new flashcard
      const newFlashcard = {
        title: title,
        content: content,
        originalText: highlight.text,
        context: highlight.context || '',
        color: highlight.color,
        url: highlightUrl,
        pageTitle: highlight.title || document.title,
        timestamp: new Date().toISOString(),
        source: source
      };
      
      // Add to flashcards array
      flashcards.push(newFlashcard);
      newFlashcards.push(newFlashcard);
    });
    
    // Only save if we have any new flashcards
    if (newFlashcards.length > 0) {
      // Save to storage
      chrome.storage.local.set({ flashcards: flashcards }, function() {
        console.log('Flashcards saved:', newFlashcards.length, 'new cards');
        
        // Update the display
        loadFlashcards();
        
        // Update extraction status
        document.getElementById('extraction-status').textContent = 
          `Extracted ${newFlashcards.length} new highlight(s)!`;
      });
    } else {
      // Update the display anyway in case we have highlights but they're all duplicates
      loadFlashcards();
      
      // Update status to indicate no new highlights
      document.getElementById('extraction-status').textContent = 
        'No new highlights found. Existing highlights may already be saved.';
    }
  });
}

// Load and display saved flashcards
function loadFlashcards() {
  chrome.storage.local.get(['flashcards'], function(result) {
    const flashcards = result.flashcards || [];
    displayFlashcards(flashcards);
  });
}

// Display flashcards in the popup
function displayFlashcards(flashcards) {
  const container = document.getElementById('flashcards-container');
  
  // Clear container
  container.innerHTML = '';
  
  if (flashcards.length === 0) {
    container.innerHTML = '<p class="no-flashcards">No flashcards found. Start by highlighting text on web pages.</p>';
    return;
  }
  
  // Sort by newest first
  flashcards.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Show most recent 5 flashcards
  const recentFlashcards = flashcards.slice(0, 5);
  
  // Create flashcard elements
  recentFlashcards.forEach((card, index) => {
    const flashcard = document.createElement('div');
    flashcard.className = 'flashcard';
    
    const title = document.createElement('h3');
    title.className = 'flashcard-title';
    title.textContent = card.title || 'Untitled Flashcard';
    
    const content = document.createElement('p');
    content.className = 'flashcard-content';
    content.textContent = card.content;
    
    // Source display
    if (card.source) {
      const source = document.createElement('div');
      source.className = 'flashcard-source';
      source.textContent = `Source: ${card.source}`;
      source.style.fontSize = '11px';
      source.style.fontStyle = 'italic';
      source.style.marginTop = '5px';
      source.style.color = '#777';
      flashcard.appendChild(source);
    }
    
    const timestamp = document.createElement('div');
    timestamp.className = 'flashcard-timestamp';
    
    // Format the date
    const date = new Date(card.timestamp);
    timestamp.textContent = date.toLocaleString();
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-flashcard';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', function() {
      deleteFlashcard(index);
    });
    
    flashcard.appendChild(title);
    flashcard.appendChild(content);
    flashcard.appendChild(timestamp);
    flashcard.appendChild(deleteBtn);
    
    container.appendChild(flashcard);
  });
  
  // Add note about more cards if there are more than 5
  if (flashcards.length > 5) {
    const moreInfo = document.createElement('p');
    moreInfo.textContent = `${flashcards.length - 5} more flashcards available. Click "See All Notes" to view all.`;
    moreInfo.style.textAlign = 'center';
    moreInfo.style.fontStyle = 'italic';
    moreInfo.style.fontSize = '12px';
    moreInfo.style.margin = '15px 0';
    container.appendChild(moreInfo);
  }
}

// Delete a flashcard
function deleteFlashcard(index) {
  chrome.storage.local.get(['flashcards'], function(result) {
    const flashcards = result.flashcards || [];
    
    if (index >= 0 && index < flashcards.length) {
      // Remove the flashcard
      flashcards.splice(index, 1);
      
      // Save back to storage
      chrome.storage.local.set({ flashcards: flashcards }, function() {
        console.log('Flashcard deleted');
        
        // Refresh the display
        loadFlashcards();
      });
    }
  });
}

// Export flashcards
function exportFlashcards() {
  chrome.storage.local.get(['flashcards'], function(result) {
    const flashcards = result.flashcards || [];
    
    if (flashcards.length === 0) {
      alert('No flashcards to export');
      return;
    }
    
    // Get export format
    chrome.storage.sync.get(['settings'], function(settingsResult) {
      const settings = settingsResult.settings || {};
      const format = settings.exportFormat || 'txt';
      
      let content = '';
      const filename = `highlights-${new Date().toISOString().split('T')[0]}.${format}`;
      
      switch (format) {
        case 'txt':
          // Plain text format
          flashcards.forEach(card => {
            content += `${card.title || 'Untitled'}\n`;
            content += `${card.content}\n\n`;
            if (card.source) {
              content += `Source: ${card.source}\n`;
            }
            if (card.url) {
              content += `URL: ${card.url}\n`;
            }
            content += `Date: ${new Date(card.timestamp).toLocaleString()}\n`;
            content += '-'.repeat(40) + '\n\n';
          });
          break;
          
        case 'csv':
          // CSV format
          content = 'Title,Content,Source,URL,Date\n';
          flashcards.forEach(card => {
            content += `"${(card.title || 'Untitled').replace(/"/g, '""')}",`;
            content += `"${card.content.replace(/"/g, '""')}",`;
            content += `"${(card.source || '').replace(/"/g, '""')}",`;
            content += `"${(card.url || '').replace(/"/g, '""')}",`;
            content += `"${new Date(card.timestamp).toLocaleString()}"\n`;
          });
          break;
          
        case 'json':
          // JSON format
          content = JSON.stringify(flashcards, null, 2);
          break;
      }
      
      // Create download link
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 100);
    });
  });
}

// Clear all flashcards
function clearFlashcards() {
  if (confirm('Are you sure you want to clear all flashcards? This cannot be undone.')) {
    chrome.storage.local.set({ flashcards: [] }, function() {
      console.log('All flashcards cleared');
      
      // Refresh the display
      loadFlashcards();
    });
  }
}

// Function to open the notes page
function openNotesPage() {
  chrome.tabs.create({ url: 'notes.html' });
}

// Enhance PDF support
function enhancePdfSupport(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    function: () => {
      // This script runs in the context of a PDF document
      
      // Check if this is a PDF viewer
      const isPdfViewer = document.querySelector('embed[type="application/pdf"]') || 
                          document.querySelector('object[type="application/pdf"]') ||
                          document.querySelector('.pdfViewer');
      
      if (!isPdfViewer) return;
      
      console.log("Enhancing PDF support for highlight extraction");
      
      // Improved text selection in the PDF viewer
      const enhancePdfSelection = () => {
        // Listen for text selection events
        document.addEventListener('mouseup', () => {
          const selection = window.getSelection();
          const selectedText = selection.toString().trim();
          
          if (selectedText.length > 0) {
            // Notify the content script about the selection
            chrome.runtime.sendMessage({
              action: "pdfSelection",
              text: selectedText,
              url: window.location.href,
              title: document.title || window.location.pathname.split('/').pop()
            });
          }
        });
      };
      
      // Start enhancing the PDF experience
      enhancePdfSelection();
    }
  });
}

// Load settings
function loadSettings() {
  chrome.storage.sync.get(['settings'], function(result) {
    const settings = result.settings || {};
    
    // Set highlight color
    const colorPicker = document.getElementById('highlight-color');
    if (colorPicker) {
      colorPicker.value = settings.highlightColor || '#ffeb3b';
    }
    
    // Set export format
    const formatSelect = document.getElementById('export-format');
    if (formatSelect && settings.exportFormat) {
      formatSelect.value = settings.exportFormat;
    }
    
    // Set PDF support
    const pdfCheckbox = document.getElementById('improve-pdf');
    if (pdfCheckbox) {
      pdfCheckbox.checked = settings.improvePdf !== false; // Default to true
    }
    
    // Set persistent highlights
    const persistentHighlights = document.getElementById('persistent-highlights');
    if (persistentHighlights) {
      // Default to true
      persistentHighlights.checked = settings.persistentHighlights !== false;
    }
    
    // Apply dark mode if needed
    if (settings.darkMode) {
      document.body.classList.add('dark-theme');
    }
  });
}

// Save settings
function saveSettings() {
  const colorPicker = document.getElementById('highlight-color');
  const formatSelect = document.getElementById('export-format');
  const pdfCheckbox = document.getElementById('improve-pdf');
  const persistentHighlights = document.getElementById('persistent-highlights');
  
  chrome.storage.sync.get(['settings'], function(result) {
    // Get existing settings or create new object
    const settings = result.settings || {};
    
    // Update settings
    if (colorPicker) {
      settings.highlightColor = colorPicker.value;
    }
    
    if (formatSelect) {
      settings.exportFormat = formatSelect.value;
    }
    
    if (pdfCheckbox) {
      settings.improvePdf = pdfCheckbox.checked;
    }
    
    if (persistentHighlights) {
      settings.persistentHighlights = persistentHighlights.checked;
      
      // Send message to active tab about the persistent highlights setting
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "updatePersistentHighlights",
            persistent: persistentHighlights.checked
          });
        }
      });
    }
    
    // Save dark mode state
    settings.darkMode = document.body.classList.contains('dark-theme');
    
    // Save to storage
    chrome.storage.sync.set({ settings: settings }, function() {
      // Show saved message
      const saveBtn = document.getElementById('saveSettings');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saved!';
      
      // Revert button text after a delay
      setTimeout(() => {
        saveBtn.textContent = originalText;
      }, 1500);
    });
  });
}
