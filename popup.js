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
  
  // Check if we're in a PDF on popup open
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const isPdf = tabs[0].url.toLowerCase().includes('.pdf');
    if (isPdf) {
      // For PDFs, show a special notice
      const statusElement = document.getElementById('extraction-status');
      statusElement.innerHTML = '<strong>PDF Detected:</strong> Select text and click Highlight!';
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
      
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: (color) => {
          // Send a message to the content script to highlight the selection
          chrome.runtime.sendMessage({
            action: "highlightSelection",
            color: color
          });
        },
        args: [highlightColor]
      });
    });
  });
}

// Function to extract highlights from the active tab
function extractHighlights() {
  // Show loading indicator
  document.getElementById('extraction-status').textContent = "Extracting highlights...";
  
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      function: () => {
        // This function runs in the context of the web page
        return chrome.runtime.sendMessage({action: "extractHighlights"});
      }
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
      chrome.tabs.sendMessage(tabs[0].id, {action: "extractHighlights"}, function(response) {
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
    
    // Process new highlights
    highlights.forEach(highlight => {
      // Skip system messages
      if (highlight.isCanvasWarning || highlight.isLatexWarning) {
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
      
      flashcards.push({
        title: title,
        content: content,
        originalText: highlight.text,
        context: highlight.context,
        timestamp: highlight.timestamp,
        color: highlight.color,
        source: highlight.url || window.location.href
      });
    });
    
    // Save updated flashcards
    chrome.storage.local.set({ flashcards: flashcards }, function() {
      // Update the displayed flashcards
      displayFlashcards(flashcards);
    });
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
  const flashcardsContainer = document.getElementById('flashcards-container');
  
  if (!flashcards || flashcards.length === 0) {
    flashcardsContainer.innerHTML = '<p class="no-flashcards">No flashcards yet. Extract some highlights!</p>';
    return;
  }
  
  // Clear the container
  flashcardsContainer.innerHTML = '';
  
  // Display flashcards
  flashcards.forEach((flashcard, index) => {
    const card = document.createElement('div');
    card.className = 'flashcard';
    
    // Apply color if available
    if (flashcard.color) {
      card.style.borderLeft = `4px solid ${flashcard.color}`;
    }
    
    const title = document.createElement('h3');
    title.className = 'flashcard-title';
    title.textContent = flashcard.title || `Highlight ${index + 1}`;
    
    const content = document.createElement('p');
    content.className = 'flashcard-content';
    content.textContent = flashcard.content;
    
    const timestamp = document.createElement('div');
    timestamp.className = 'flashcard-timestamp';
    const date = new Date(flashcard.timestamp);
    timestamp.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-flashcard';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', () => {
      deleteFlashcard(index);
    });
    
    card.appendChild(title);
    card.appendChild(content);
    card.appendChild(timestamp);
    card.appendChild(deleteBtn);
    
    flashcardsContainer.appendChild(card);
  });
}

// Delete a flashcard
function deleteFlashcard(index) {
  chrome.storage.local.get(['flashcards'], function(result) {
    let flashcards = result.flashcards || [];
    
    // Remove the flashcard at the specified index
    flashcards.splice(index, 1);
    
    // Save the updated flashcards
    chrome.storage.local.set({ flashcards: flashcards }, function() {
      // Update the display
      displayFlashcards(flashcards);
    });
  });
}

// Export flashcards
function exportFlashcards() {
  chrome.storage.local.get(['flashcards'], function(result) {
    const flashcards = result.flashcards || [];
    
    if (flashcards.length === 0) {
      alert('No flashcards to export!');
      return;
    }
    
    // Format for export
    const format = document.getElementById('export-format').value;
    let exportData = '';
    
    if (format === 'txt') {
      // Simple text format
      flashcards.forEach(card => {
        exportData += `Question: ${card.title || 'Untitled'}\n`;
        exportData += `Answer: ${card.content}\n`;
        exportData += `Context: ${card.context || 'N/A'}\n`;
        exportData += `Timestamp: ${card.timestamp}\n`;
        exportData += `\n---\n\n`;
      });
    } else if (format === 'json') {
      // JSON format
      exportData = JSON.stringify(flashcards, null, 2);
    } else if (format === 'csv') {
      // CSV format
      exportData = 'Title,Content,Context,Timestamp\n';
      flashcards.forEach(card => {
        // Escape quotes in CSV fields
        const title = `"${(card.title || 'Untitled').replace(/"/g, '""')}"`;
        const content = `"${card.content.replace(/"/g, '""')}"`;
        const context = `"${(card.context || '').replace(/"/g, '""')}"`;
        const timestamp = `"${card.timestamp}"`;
        
        exportData += `${title},${content},${context},${timestamp}\n`;
      });
    }
    
    // Create a download link
    const blob = new Blob([exportData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `highlights_export.${format}`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  });
}

// Clear all flashcards
function clearFlashcards() {
  if (confirm('Are you sure you want to delete all flashcards?')) {
    chrome.storage.local.set({ flashcards: [] }, function() {
      // Update the display
      displayFlashcards([]);
    });
  }
}

// Load settings
function loadSettings() {
  chrome.storage.sync.get(['settings'], function(result) {
    const settings = result.settings || {};
    
    // Update settings fields
    document.getElementById('auto-title').checked = settings.autoTitle !== false; // Default to true
    document.getElementById('auto-question').checked = settings.autoQuestion === true; // Default to false
    
    // Update color picker if exists
    const colorPicker = document.getElementById('highlight-color');
    if (colorPicker && settings.highlightColor) {
      colorPicker.value = settings.highlightColor;
    }
    
    // Apply dark mode if set
    if (settings.darkMode) {
      document.body.classList.add('dark-theme');
    }
  });
}

// Save settings
function saveSettings() {
  const settings = {
    autoTitle: document.getElementById('auto-title').checked,
    autoQuestion: document.getElementById('auto-question').checked,
    darkMode: document.body.classList.contains('dark-theme')
  };
  
  // Get color picker value if exists
  const colorPicker = document.getElementById('highlight-color');
  if (colorPicker) {
    settings.highlightColor = colorPicker.value;
  }
  
  chrome.storage.sync.set({ settings: settings }, function() {
    // Show confirmation
    document.getElementById('extraction-status').textContent = "Settings saved!";
    
    // Clear the message after 3 seconds
    setTimeout(() => {
      document.getElementById('extraction-status').textContent = "";
    }, 3000);
  });
}
