// Content script for Highlight Extractor

// Track our custom highlights in an array
let customHighlights = [];

// Initialize the extension
initialize();

function initialize() {
  console.log("Highlight Extractor: Content script loaded");
  
  // Set up the highlight action on mouseup (when user finishes selecting text)
  document.addEventListener('mouseup', handleTextSelection);
  
  // Add a listener for messages from the popup or background
  chrome.runtime.onMessage.addListener(handleMessages);
  
  // Create our highlight container
  createHighlightContainer();
}

// Create a container to hold our highlights
function createHighlightContainer() {
  // Check if container already exists
  if (document.getElementById('highlight-extractor-container')) {
    return;
  }
  
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
    if (!container) return;
    
    // Position the container near the selection
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    container.style.left = `${window.scrollX + rect.left}px`;
    container.style.top = `${window.scrollY + rect.top - 40}px`;
    container.style.display = 'block';
  }
}

// Highlight the selected text
function highlightSelectedText(color, source) {
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
    title: document.title,
    source: source || '' // Add source attribution
  };
  
  // Add to our custom highlights array
  customHighlights.push(highlight);
  
  // Apply the highlight to the DOM
  try {
    range.surroundContents(highlightSpan);
    
    // Hide the highlight container
    const container = document.getElementById('highlight-extractor-container');
    if (container) {
      container.style.display = 'none';
    }
    
    // Clear the selection
    selection.removeAllRanges();
    
    console.log("Highlight applied successfully:", highlight);
    return highlight;
  } catch (e) {
    console.error("Error highlighting text:", e);
    alert("Could not apply highlight. The selection might span across multiple elements.");
    return null;
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

// Handle messages from popup or background scripts
function handleMessages(request, sender, sendResponse) {
  console.log("Content script received message:", request);
  
  if (request.action === "extractHighlights") {
    // Return all custom highlights for this page
    console.log("Extracting highlights, found:", customHighlights.length);
    
    // If a source is provided in the request, add it to highlights that don't have a source
    if (request.source) {
      customHighlights.forEach(highlight => {
        if (!highlight.source) {
          highlight.source = request.source;
        }
      });
    }
    
    // Send all highlights
    sendResponse({ highlights: customHighlights });
    return true;
  }
  
  if (request.action === "highlightSelection") {
    // Add a highlight using the selected text
    highlightSelectedText(request.color, request.source);
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === "clearHighlights") {
    // Clear all highlights from the page
    clearHighlights();
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === "pdfSelection") {
    // Handle PDF selection by creating a highlight object
    const highlight = {
      id: 'pdf-highlight-' + Date.now(),
      text: request.text,
      color: '#ffeb3b', // Default color for PDF highlights
      context: '',
      timestamp: new Date().toISOString(),
      url: request.url || window.location.href,
      title: request.title || document.title,
      source: request.source || '',
      isPdf: true
    };
    
    // Add to our custom highlights array
    customHighlights.push(highlight);
    
    sendResponse({ success: true, highlight: highlight });
    return true;
  }
  
  return false; // No response
}

// Clear all highlights from the page
function clearHighlights() {
  console.log("Clearing all highlights");
  
  // Remove highlight elements
  const highlights = document.querySelectorAll('.highlight-extractor-highlight');
  highlights.forEach(highlight => {
    // Replace with the text content
    const text = highlight.textContent;
    const textNode = document.createTextNode(text);
    highlight.parentNode.replaceChild(textNode, highlight);
  });
  
  // Clear in-memory highlights
  customHighlights = [];
}