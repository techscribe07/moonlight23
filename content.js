// Content script for Highlight Extractor

// Track our custom highlights in an array
let customHighlights = [];

// Initialize the extension
initialize();

function initialize() {
  console.log("Highlight Extractor: Content script loaded");
  
  // Load any saved highlights for this page
  loadSavedHighlights();
  
  // Set up the highlight action on mouseup (when user finishes selecting text)
  document.addEventListener('mouseup', handleTextSelection);
  
  // Add a listener for messages from the popup or background
  chrome.runtime.onMessage.addListener(handleMessages);
  
  // Create our highlight container
  createHighlightContainer();
}

// Create a container to hold our highlights
function createHighlightContainer() {
  const container = document.createElement('div');
  container.id = 'highlight-extractor-container';
  container.style.position = 'absolute';
  container.style.zIndex = '9999';
  container.style.display = 'none';
  
  // Add a highlight button
  const highlightBtn = document.createElement('button');
  highlightBtn.textContent = 'Highlight';
  highlightBtn.style.background = '#ffeb3b';
  highlightBtn.style.border = '1px solid #000';
  highlightBtn.style.borderRadius = '4px';
  highlightBtn.style.padding = '5px 10px';
  highlightBtn.style.cursor = 'pointer';
  highlightBtn.style.marginRight = '5px';
  highlightBtn.addEventListener('click', () => highlightSelectedText('#ffeb3b'));
  
  // Add a delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'X';
  deleteBtn.style.background = '#f44336';
  deleteBtn.style.color = 'white';
  deleteBtn.style.border = '1px solid #000';
  deleteBtn.style.borderRadius = '4px';
  deleteBtn.style.padding = '5px 10px';
  deleteBtn.style.cursor = 'pointer';
  deleteBtn.addEventListener('click', () => {
    container.style.display = 'none';
  });
  
  // Add buttons to container
  container.appendChild(highlightBtn);
  container.appendChild(deleteBtn);
  
  // Add container to page
  document.body.appendChild(container);
}

// Handle text selection
function handleTextSelection(event) {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  // If text is selected, show the highlight button
  if (selectedText.length > 0) {
    const container = document.getElementById('highlight-extractor-container');
    
    // Position the container near the selection
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    container.style.left = `${window.scrollX + rect.left}px`;
    container.style.top = `${window.scrollY + rect.top - 40}px`;
    container.style.display = 'block';
  }
}

// Highlight the selected text
function highlightSelectedText(color) {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText.length === 0) return;
  
  const range = selection.getRangeAt(0);
  
  // Create a span element to wrap the highlighted text
  const highlightSpan = document.createElement('span');
  highlightSpan.className = 'highlight-extractor-highlight';
  highlightSpan.style.backgroundColor = color;
  highlightSpan.style.display = 'inline';
  highlightSpan.dataset.timestamp = new Date().toISOString();
  
  // Create a unique ID for this highlight
  const highlightId = 'highlight-' + Date.now();
  highlightSpan.id = highlightId;
  
  // Store highlight information
  const highlight = {
    id: highlightId,
    text: selectedText,
    color: color,
    context: getContextFromSelection(selection),
    timestamp: new Date().toISOString(),
    url: window.location.href,
    title: document.title
  };
  
  // Add to our custom highlights array
  customHighlights.push(highlight);
  
  // Save the highlight
  saveHighlight(highlight);
  
  // Apply the highlight to the DOM
  try {
    range.surroundContents(highlightSpan);
    
    // Hide the highlight container
    document.getElementById('highlight-extractor-container').style.display = 'none';
    
    // Clear the selection
    selection.removeAllRanges();
  } catch (e) {
    console.error("Error highlighting text:", e);
    alert("Could not apply highlight. The selection might span across multiple elements.");
  }
}

// Get context from selection (surrounding text)
function getContextFromSelection(selection) {
  if (selection.rangeCount === 0) return '';
  
  const range = selection.getRangeAt(0);
  const startNode = range.startContainer;
  
  // Try to get containing paragraph or similar element
  let element = startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : startNode;
  
  // Look up a few levels to find a good container
  let parent = element;
  let maxLevel = 3;
  
  while (parent && maxLevel > 0) {
    if (parent.tagName === 'P' || 
        parent.tagName === 'H1' || 
        parent.tagName === 'H2' || 
        parent.tagName === 'H3' ||
        (parent.tagName === 'DIV' && parent.childNodes.length > 5)) {
      return parent.textContent.trim();
    }
    parent = parent.parentElement;
    maxLevel--;
  }
  
  // If no good container found, just return some surrounding text
  return element.textContent.trim();
}

// Save a highlight to storage
function saveHighlight(highlight) {
  // Get the URL key for storage
  const urlKey = encodeURIComponent(window.location.href);
  
  // Retrieve existing highlights for this page
  chrome.storage.local.get(['highlights'], function(result) {
    let allHighlights = result.highlights || {};
    let pageHighlights = allHighlights[urlKey] || [];
    
    // Add the new highlight
    pageHighlights.push(highlight);
    
    // Update storage
    allHighlights[urlKey] = pageHighlights;
    chrome.storage.local.set({ highlights: allHighlights }, function() {
      console.log('Highlight saved');
    });
  });
}

// Load saved highlights for the current page
function loadSavedHighlights() {
  const urlKey = encodeURIComponent(window.location.href);
  
  chrome.storage.local.get(['highlights'], function(result) {
    const allHighlights = result.highlights || {};
    const pageHighlights = allHighlights[urlKey] || [];
    
    // Update our custom highlights array
    customHighlights = pageHighlights;
    
    // Apply the highlights to the page
    if (pageHighlights.length > 0) {
      // Wait a bit for the page to fully load
      setTimeout(() => {
        applyHighlightsToPage(pageHighlights);
      }, 500);
    }
  });
}

// Apply saved highlights to the page
function applyHighlightsToPage(highlights) {
  // Create a text node walker to find the text
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  highlights.forEach(highlight => {
    let node;
    let found = false;
    
    // Walk through all text nodes
    while (node = walker.nextNode()) {
      const text = node.textContent;
      const index = text.indexOf(highlight.text);
      
      if (index >= 0) {
        // Found the text, create a range
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + highlight.text.length);
        
        // Create highlight span
        const span = document.createElement('span');
        span.className = 'highlight-extractor-highlight';
        span.id = highlight.id;
        span.style.backgroundColor = highlight.color;
        span.dataset.timestamp = highlight.timestamp;
        
        try {
          // Apply the highlight
          range.surroundContents(span);
          found = true;
          break;
        } catch (e) {
          console.error("Error applying saved highlight:", e);
        }
      }
    }
    
    if (!found) {
      console.log("Could not find text to highlight:", highlight.text);
    }
  });
}

// Handle messages from popup or background scripts
function handleMessages(request, sender, sendResponse) {
  console.log("Received message:", request);
  
  if (request.action === "extractHighlights") {
    // Return all custom highlights for this page
    sendResponse({ highlights: customHighlights });
    return true;
  }
  
  if (request.action === "clearHighlights") {
    // Remove all highlights from the page
    clearHighlights();
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === "highlightSelection") {
    // Highlight the current selection
    highlightSelectedText(request.color || '#ffeb3b');
    sendResponse({ success: true });
    return true;
  }
}

// Clear all highlights from the page
function clearHighlights() {
  // Remove highlight elements
  const highlights = document.querySelectorAll('.highlight-extractor-highlight');
  highlights.forEach(highlight => {
    // Replace with the text content
    const text = highlight.textContent;
    const textNode = document.createTextNode(text);
    highlight.parentNode.replaceChild(textNode, highlight);
  });
  
  // Clear storage for this page
  const urlKey = encodeURIComponent(window.location.href);
  chrome.storage.local.get(['highlights'], function(result) {
    let allHighlights = result.highlights || {};
    delete allHighlights[urlKey];
    chrome.storage.local.set({ highlights: allHighlights }, function() {
      console.log('Highlights cleared');
    });
  });
  
  // Clear our custom highlights array
  customHighlights = [];
}
