document.addEventListener('DOMContentLoaded', function() {
  // Load saved flashcards/notes
  loadNotes();
  
  // Set up theme toggle
  document.getElementById('themeToggle').addEventListener('click', function() {
    document.body.classList.toggle('dark-theme');
    
    // Save theme preference
    chrome.storage.sync.get(['settings'], function(result) {
      const settings = result.settings || {};
      settings.darkMode = document.body.classList.contains('dark-theme');
      chrome.storage.sync.set({ settings: settings });
    });
  });
  
  // Load theme setting
  chrome.storage.sync.get(['settings'], function(result) {
    const settings = result.settings || {};
    if (settings.darkMode) {
      document.body.classList.add('dark-theme');
    }
  });
  
  // Set up export PDF button
  document.getElementById('exportPdf').addEventListener('click', function() {
    window.print();
  });
  
  // Set up export button
  document.getElementById('exportBtn').addEventListener('click', function() {
    exportNotes();
  });
  
  // Set up clear button
  document.getElementById('clearBtn').addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all notes? This cannot be undone.')) {
      clearNotes();
    }
  });
});

// Load and display saved notes
function loadNotes() {
  chrome.storage.local.get(['flashcards'], function(result) {
    let flashcards = result.flashcards || [];
    
    // Check for and remove duplicates before displaying
    const cleanedFlashcards = removeDuplicateNotes(flashcards);
    
    // If we removed duplicates, save the cleaned list back
    if (cleanedFlashcards.length !== flashcards.length) {
      console.log(`Removed ${flashcards.length - cleanedFlashcards.length} duplicate notes`);
      chrome.storage.local.set({ flashcards: cleanedFlashcards }, function() {
        displayNotes(cleanedFlashcards);
      });
    } else {
      displayNotes(cleanedFlashcards);
    }
  });
}

// Remove duplicate notes based on content and URL
function removeDuplicateNotes(notes) {
  // Use a Map to track unique notes
  // The key is a combination of content and URL
  const uniqueMap = new Map();
  
  notes.forEach(note => {
    // Create a unique key for each note based on text content and URL
    const key = `${note.originalText || note.content}|${note.url || ''}`;
    
    // Only keep the most recent version of each note
    if (!uniqueMap.has(key) || new Date(note.timestamp) > new Date(uniqueMap.get(key).timestamp)) {
      uniqueMap.set(key, note);
    }
  });
  
  // Convert back to array and return
  return Array.from(uniqueMap.values());
}

// Display notes in the page
function displayNotes(notes) {
  const container = document.getElementById('notes-container');
  
  // Clear container
  container.innerHTML = '';
  
  if (notes.length === 0) {
    container.innerHTML = '<div class="no-notes">No notes found. Add highlights from web pages to see them here.</div>';
    return;
  }
  
  // Sort by newest first
  notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Create note cards
  notes.forEach((note, index) => {
    const noteCard = document.createElement('div');
    noteCard.className = 'note-card';
    noteCard.dataset.index = index;
    
    const title = document.createElement('h3');
    title.className = 'note-title';
    title.textContent = note.title || 'Untitled Note';
    title.contentEditable = 'false';
    
    const content = document.createElement('p');
    content.className = 'note-content';
    content.textContent = note.content;
    content.contentEditable = 'false';
    
    const source = document.createElement('div');
    source.className = 'note-source';
    
    // Include source information if available
    if (note.url || note.title) {
      let sourceText = 'Source: ';
      if (note.title) {
        sourceText += note.title;
      }
      if (note.url) {
        const urlObj = new URL(note.url);
        sourceText += ` (${urlObj.hostname})`;
      }
      source.textContent = sourceText;
    }
    
    const timestamp = document.createElement('div');
    timestamp.className = 'note-timestamp';
    
    // Format the date
    const date = new Date(note.timestamp);
    timestamp.textContent = date.toLocaleString();
    
    // Buttons container
    const buttons = document.createElement('div');
    buttons.className = 'note-buttons';
    
    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'note-button edit-button';
    editBtn.textContent = '✎';
    editBtn.title = 'Edit Note';
    editBtn.addEventListener('click', function() {
      // Toggle edit mode
      const isEditing = title.contentEditable === 'true';
      
      if (isEditing) {
        // Save changes
        title.contentEditable = 'false';
        content.contentEditable = 'false';
        editBtn.textContent = '✎';
        
        // Update note in storage
        updateNote(index, {
          title: title.textContent,
          content: content.textContent
        });
      } else {
        // Enter edit mode
        title.contentEditable = 'true';
        content.contentEditable = 'true';
        editBtn.textContent = '💾';
        
        // Focus the title
        title.focus();
      }
    });
    
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'note-button delete-button';
    deleteBtn.textContent = '✕';
    deleteBtn.title = 'Delete Note';
    deleteBtn.addEventListener('click', function() {
      if (confirm('Are you sure you want to delete this note?')) {
        deleteNote(index);
      }
    });
    
    // Add buttons to container
    buttons.appendChild(editBtn);
    buttons.appendChild(deleteBtn);
    
    // Add elements to card
    noteCard.appendChild(title);
    noteCard.appendChild(content);
    noteCard.appendChild(source);
    noteCard.appendChild(timestamp);
    noteCard.appendChild(buttons);
    
    // Add card to container
    container.appendChild(noteCard);
  });
}

// Update a note
function updateNote(index, updates) {
  chrome.storage.local.get(['flashcards'], function(result) {
    const flashcards = result.flashcards || [];
    
    if (index >= 0 && index < flashcards.length) {
      // Update the note
      Object.assign(flashcards[index], updates);
      
      // Save back to storage
      chrome.storage.local.set({ flashcards: flashcards }, function() {
        console.log('Note updated');
      });
    }
  });
}

// Delete a note
function deleteNote(index) {
  chrome.storage.local.get(['flashcards'], function(result) {
    const flashcards = result.flashcards || [];
    
    if (index >= 0 && index < flashcards.length) {
      // Remove the note
      flashcards.splice(index, 1);
      
      // Save back to storage
      chrome.storage.local.set({ flashcards: flashcards }, function() {
        console.log('Note deleted');
        
        // Refresh the display
        loadNotes();
      });
    }
  });
}

// Clear all notes
function clearNotes() {
  chrome.storage.local.set({ flashcards: [] }, function() {
    console.log('All notes cleared');
    
    // Refresh the display
    loadNotes();
  });
}

// Export notes
function exportNotes() {
  chrome.storage.local.get(['flashcards'], function(result) {
    const flashcards = result.flashcards || [];
    
    if (flashcards.length === 0) {
      alert('No notes to export');
      return;
    }
    
    // Get export format
    chrome.storage.sync.get(['settings'], function(settingsResult) {
      const settings = settingsResult.settings || {};
      const format = settings.exportFormat || 'txt';
      
      let content = '';
      const filename = `highlight-notes-${new Date().toISOString().split('T')[0]}.${format}`;
      
      switch (format) {
        case 'txt':
          // Plain text format
          flashcards.forEach(note => {
            content += `${note.title || 'Untitled Note'}\n`;
            content += `${note.content}\n\n`;
            if (note.url) {
              content += `Source: ${note.url}\n`;
            }
            content += `Date: ${new Date(note.timestamp).toLocaleString()}\n`;
            content += '-'.repeat(40) + '\n\n';
          });
          break;
          
        case 'csv':
          // CSV format
          content = 'Title,Content,Source,Date\n';
          flashcards.forEach(note => {
            content += `"${(note.title || 'Untitled Note').replace(/"/g, '""')}",`;
            content += `"${note.content.replace(/"/g, '""')}",`;
            content += `"${note.url || ''}",`;
            content += `"${new Date(note.timestamp).toLocaleString()}"\n`;
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
