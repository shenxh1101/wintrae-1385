(function() {
  'use strict';

  let currentSelection = null;
  let currentRange = null;
  let selectedColor = 'yellow';
  let selectedDifficulty = 'medium';
  let pageNotes = [];
  let isRestoring = false;

  function init() {
    createToolbar();
    createTooltip();
    createQuickAddModal();
    setupEventListeners();
    setupMessageListeners();
    
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      loadPageNotes();
    } else {
      window.addEventListener('load', loadPageNotes);
    }
  }

  function createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'note-toolbar';
    toolbar.innerHTML = `
      <button class="color-btn yellow" data-color="yellow" title="黄色"></button>
      <button class="color-btn green" data-color="green" title="绿色"></button>
      <button class="color-btn blue" data-color="blue" title="蓝色"></button>
      <button class="color-btn pink" data-color="pink" title="粉色"></button>
      <button class="primary" id="btn-add-note">添加笔记</button>
    `;
    document.body.appendChild(toolbar);
  }

  function createTooltip() {
    const tooltip = document.createElement('div');
    tooltip.id = 'note-tooltip';
    document.body.appendChild(tooltip);
  }

  function createQuickAddModal() {
    const overlay = document.createElement('div');
    overlay.id = 'note-modal-overlay';
    document.body.appendChild(overlay);

    const modal = document.createElement('div');
    modal.id = 'note-quick-add-modal';
    modal.innerHTML = `
      <h3>添加笔记</h3>
      <div class="note-text-preview" id="note-preview-text"></div>
      <label>备注</label>
      <textarea id="note-comment" placeholder="添加你的备注..."></textarea>
      <label>标签 (用逗号分隔)</label>
      <input type="text" id="note-tags" placeholder="例如: 重点, 考试, 理解">
      <label>难度</label>
      <div class="difficulty-options">
        <button class="difficulty-btn" data-difficulty="easy">简单</button>
        <button class="difficulty-btn active" data-difficulty="medium">中等</button>
        <button class="difficulty-btn" data-difficulty="hard">困难</button>
      </div>
      <div class="modal-actions">
        <button class="btn-cancel" id="btn-cancel-note">取消</button>
        <button class="btn-save" id="btn-save-note">保存</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function setupEventListeners() {
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('mousedown', handleMouseDown);

    document.getElementById('note-toolbar').addEventListener('click', handleToolbarClick);
    document.getElementById('btn-add-note').addEventListener('click', openQuickAddModal);
    document.getElementById('btn-cancel-note').addEventListener('click', closeQuickAddModal);
    document.getElementById('btn-save-note').addEventListener('click', saveNote);

    document.querySelectorAll('.difficulty-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        selectedDifficulty = this.dataset.difficulty;
      });
    });

    document.getElementById('note-modal-overlay').addEventListener('click', closeQuickAddModal);

    document.addEventListener('click', function(e) {
      const highlight = e.target.closest('.note-highlight');
      if (highlight) {
        showNoteTooltip(highlight);
      } else {
        hideTooltip();
      }
    });
  }

  function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case 'addNoteFromSelection':
          if (message.text) {
            currentSelection = message.text;
          }
          openQuickAddModal();
          break;
        case 'highlightSelection':
          highlightSelectedText(selectedColor);
          break;
        case 'flashHighlight':
          const flashSuccess = flashHighlight(message.noteId);
          sendResponse({ success: flashSuccess });
          break;
        case 'updateHighlight':
          updateHighlight(message.note);
          sendResponse({ success: true });
          break;
        case 'removeHighlight':
          removeHighlight(message.noteId);
          sendResponse({ success: true });
          break;
        case 'getAllHighlights':
          const highlights = getAllHighlightIds();
          sendResponse({ success: true, highlights });
          break;
        case 'scrollToNote':
          const result = scrollToNote(message.noteId);
          sendResponse({ success: result });
          break;
      }
    });
  }

  function handleTextSelection(e) {
    if (isRestoring) return;
    
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0 && selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0);
      
      if (isInsideToolbar(e.target) || isInsideModal(e.target) || isInsideTooltip(e.target)) {
        return;
      }
      
      currentSelection = selection.toString().trim();
      currentRange = range.cloneRange();
      
      const rect = range.getBoundingClientRect();
      showToolbar(rect.left + window.scrollX, rect.top + window.scrollY - 45);
    } else {
      if (!isInsideToolbar(e.target) && !isInsideModal(e.target) && !isInsideTooltip(e.target)) {
        hideToolbar();
      }
    }
  }

  function handleMouseDown(e) {
    if (!isInsideToolbar(e.target) && !isInsideModal(e.target) && !isInsideTooltip(e.target)) {
      hideTooltip();
    }
  }

  function isInsideToolbar(element) {
    const toolbar = document.getElementById('note-toolbar');
    return toolbar && toolbar.contains(element);
  }

  function isInsideModal(element) {
    const modal = document.getElementById('note-quick-add-modal');
    const overlay = document.getElementById('note-modal-overlay');
    return (modal && modal.contains(element)) || (overlay && overlay.contains(element));
  }

  function isInsideTooltip(element) {
    const tooltip = document.getElementById('note-tooltip');
    return tooltip && tooltip.contains(element);
  }

  function showToolbar(x, y) {
    const toolbar = document.getElementById('note-toolbar');
    if (!toolbar) return;
    toolbar.style.left = x + 'px';
    toolbar.style.top = y + 'px';
    toolbar.classList.add('visible');
  }

  function hideToolbar() {
    const toolbar = document.getElementById('note-toolbar');
    if (toolbar) toolbar.classList.remove('visible');
  }

  function handleToolbarClick(e) {
    if (e.target.classList.contains('color-btn')) {
      selectedColor = e.target.dataset.color;
      highlightSelectedText(selectedColor);
    }
  }

  function highlightSelectedText(color) {
    if (!currentRange) return;

    const range = currentRange.cloneRange();
    
    try {
      const span = document.createElement('span');
      span.className = 'note-highlight ' + color;
      span.dataset.text = currentSelection;
      span.dataset.timestamp = Date.now().toString();
      
      range.surroundContents(span);
      hideToolbar();
      window.getSelection().removeAllRanges();
    } catch (e) {
      console.warn('无法高亮选中的文本:', e);
    }
  }

  function openQuickAddModal() {
    const modal = document.getElementById('note-quick-add-modal');
    const overlay = document.getElementById('note-modal-overlay');
    const preview = document.getElementById('note-preview-text');
    
    preview.textContent = currentSelection || '';
    
    modal.classList.add('visible');
    overlay.classList.add('visible');
    hideToolbar();
  }

  function closeQuickAddModal() {
    const modal = document.getElementById('note-quick-add-modal');
    const overlay = document.getElementById('note-modal-overlay');
    
    modal.classList.remove('visible');
    overlay.classList.remove('visible');
    
    document.getElementById('note-comment').value = '';
    document.getElementById('note-tags').value = '';
    selectedDifficulty = 'medium';
    document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.difficulty-btn[data-difficulty="medium"]').classList.add('active');
  }

  function saveNote() {
    const comment = document.getElementById('note-comment').value.trim();
    const tagsStr = document.getElementById('note-tags').value.trim();
    const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(t => t) : [];
    
    const videoTime = getVideoTime();
    const position = currentRange ? getSelectionPosition(currentRange, currentSelection) : null;
    
    const noteData = {
      text: currentSelection || '',
      comment: comment,
      tags: tags,
      difficulty: selectedDifficulty,
      color: selectedColor,
      pageTitle: document.title,
      url: window.location.href,
      timestamp: videoTime,
      position: position,
      createdAt: Date.now()
    };
    
    chrome.runtime.sendMessage({
      action: 'saveNote',
      note: noteData
    }, response => {
      if (response && response.success) {
        const savedNote = response.note;
        
        if (currentRange) {
          try {
            const span = document.createElement('span');
            span.className = 'note-highlight ' + selectedColor;
            span.dataset.noteId = savedNote.id;
            span.dataset.text = currentSelection;
            span.title = comment || '点击查看笔记';
            currentRange.surroundContents(span);
          } catch (e) {
            console.warn('无法高亮文本:', e);
          }
        }
        
        pageNotes.push(savedNote);
        closeQuickAddModal();
        window.getSelection().removeAllRanges();
      }
    });
  }

  function getSelectionPosition(range, text) {
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    
    const startXPath = getXPath(startContainer);
    const endXPath = getXPath(endContainer);
    
    const beforeText = getTextBeforePosition(startContainer, range.startOffset);
    const afterText = getTextAfterPosition(endContainer, range.endOffset);
    
    const occurrenceIndex = getOccurrenceIndex(text, range);
    
    return {
      startXPath: startXPath,
      endXPath: endXPath,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      occurrenceIndex: occurrenceIndex,
      beforeContext: beforeText.slice(-30),
      afterContext: afterText.slice(0, 30),
      textLength: text.length
    };
  }

  function getXPath(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return getXPath(node.parentNode) + '/text()[' + getTextNodeIndex(node) + ']';
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    
    if (node.id) {
      return '//*[@id="' + node.id + '"]';
    }
    
    let path = '';
    let current = node;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let count = 0;
      let sibling = current.previousSibling;
      
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) {
          count++;
        }
        sibling = sibling.previousSibling;
      }
      
      const tagName = current.tagName.toLowerCase();
      path = '/' + tagName + '[' + (count + 1) + ']' + path;
      
      if (current === document.body) break;
      current = current.parentNode;
    }
    
    return path;
  }

  function getTextNodeIndex(textNode) {
    let index = 1;
    let sibling = textNode.previousSibling;
    while (sibling) {
      if (sibling.nodeType === Node.TEXT_NODE) {
        index++;
      }
      sibling = sibling.previousSibling;
    }
    return index;
  }

  function getTextBeforePosition(container, offset) {
    if (container.nodeType === Node.TEXT_NODE) {
      return container.nodeValue.substring(0, offset);
    }
    return '';
  }

  function getTextAfterPosition(container, offset) {
    if (container.nodeType === Node.TEXT_NODE) {
      return container.nodeValue.substring(offset);
    }
    return '';
  }

  function getOccurrenceIndex(searchText, range) {
    const rangeText = range.toString();
    if (!rangeText) return 0;
    
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          if (!node.nodeValue || node.nodeValue.trim().length === 0) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.parentElement.closest('.note-highlight, script, style, noscript')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    let count = 0;
    let found = false;
    let node;
    
    while (node = walker.nextNode()) {
      const text = node.nodeValue;
      let startIndex = 0;
      
      while ((startIndex = text.indexOf(searchText, startIndex)) !== -1) {
        if (node === range.startContainer && startIndex === range.startOffset) {
          found = true;
          break;
        }
        count++;
        startIndex += searchText.length;
      }
      
      if (found) break;
    }
    
    return count;
  }

  function getVideoTime() {
    const videos = document.querySelectorAll('video');
    for (const video of videos) {
      if (!video.paused || video.currentTime > 0) {
        return video.currentTime;
      }
    }
    return null;
  }

  function showNoteTooltip(element) {
    const tooltip = document.getElementById('note-tooltip');
    const noteId = element.dataset.noteId;
    
    if (!noteId) return;
    
    const note = pageNotes.find(n => n.id === noteId);
    if (!note) return;
    
    let html = `<div class="tooltip-title"><strong>笔记</strong></div>`;
    
    if (note.text) {
      html += `<div class="tooltip-text">${escapeHtml(note.text)}</div>`;
    }
    
    if (note.comment) {
      html += `<div class="tooltip-comment">${escapeHtml(note.comment)}</div>`;
    }
    
    if (note.tags && note.tags.length > 0) {
      html += '<div class="tooltip-tags">';
      note.tags.forEach(tag => {
        html += `<span class="tooltip-tag">${escapeHtml(tag)}</span>`;
      });
      html += '</div>';
    }
    
    if (note.difficulty) {
      const diffText = { easy: '简单', medium: '中等', hard: '困难' }[note.difficulty] || note.difficulty;
      html += `<div class="tooltip-difficulty">难度: ${diffText}</div>`;
    }
    
    tooltip.innerHTML = html;
    
    const rect = element.getBoundingClientRect();
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 8;
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.classList.add('visible');
    
    const tooltipRect = tooltip.getBoundingClientRect();
    if (left + tooltipRect.width > window.innerWidth + window.scrollX) {
      left = window.innerWidth + window.scrollX - tooltipRect.width - 10;
      tooltip.style.left = left + 'px';
    }
  }

  function hideTooltip() {
    const tooltip = document.getElementById('note-tooltip');
    if (tooltip) tooltip.classList.remove('visible');
  }

  function loadPageNotes() {
    chrome.runtime.sendMessage({
      action: 'getNotesByUrl',
      url: window.location.href
    }, response => {
      if (response && response.success) {
        pageNotes = response.notes;
        setTimeout(() => {
          restoreHighlights();
        }, 300);
      }
    });
  }

  function restoreHighlights() {
    if (pageNotes.length === 0) return;
    
    isRestoring = true;
    
    const textNotes = pageNotes.filter(note => note.text && note.text.trim().length > 0);
    
    textNotes.forEach(note => {
      try {
        restoreSingleHighlight(note);
      } catch (e) {
        console.warn('恢复高亮失败:', note.text, e);
      }
    });
    
    isRestoring = false;
  }

  function restoreSingleHighlight(note) {
    const searchText = note.text;
    if (!searchText || searchText.length < 2) return false;
    
    if (note.position) {
      const result = restoreByPosition(note);
      if (result) return true;
    }
    
    return restoreByTextSearch(note);
  }

  function restoreByPosition(note) {
    const pos = note.position;
    if (!pos) return false;
    
    try {
      const startNode = getElementByXPath(pos.startXPath);
      const endNode = getElementByXPath(pos.endXPath);
      
      if (startNode && endNode) {
        const actualStartOffset = findOffsetByContext(startNode, pos, 'before');
        const actualEndOffset = findOffsetByContext(endNode, pos, 'after');
        
        if (actualStartOffset !== -1 && actualEndOffset !== -1) {
          const range = document.createRange();
          range.setStart(startNode, actualStartOffset);
          range.setEnd(endNode, actualEndOffset);
          
          const span = document.createElement('span');
          span.className = 'note-highlight ' + (note.color || 'yellow');
          span.dataset.noteId = note.id;
          span.dataset.text = searchText;
          span.title = note.comment || '点击查看笔记';
          
          range.surroundContents(span);
          return true;
        }
      }
    } catch (e) {
      console.warn('按位置恢复失败，尝试文字匹配:', e);
    }
    
    return false;
  }

  function getElementByXPath(xpath) {
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue;
    } catch (e) {
      return null;
    }
  }

  function findOffsetByContext(node, pos, direction) {
    if (node.nodeType !== Node.TEXT_NODE) return -1;
    
    const text = node.nodeValue;
    const targetOffset = direction === 'before' ? pos.startOffset : pos.endOffset;
    const context = direction === 'before' ? pos.beforeContext : pos.afterContext;
    
    if (text.length > targetOffset && text[targetOffset] !== undefined) {
      const contextStart = direction === 'before' ? targetOffset - (context?.length || 0) : targetOffset;
      const contextEnd = direction === 'before' ? targetOffset : targetOffset + (context?.length || 0);
      const actualContext = text.substring(Math.max(0, contextStart), Math.min(text.length, contextEnd));
      
      if (actualContext === context || actualContext.length > 0 && context?.includes(actualContext)) {
        return targetOffset;
      }
    }
    
    return -1;
  }

  function restoreByTextSearch(note) {
    const searchText = note.text;
    if (!searchText || searchText.length < 2) return false;
    
    const targetIndex = note.position?.occurrenceIndex || 0;
    
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          if (!node.nodeValue || node.nodeValue.trim().length === 0) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.parentElement.closest('.note-highlight, #note-toolbar, #note-tooltip, #note-quick-add-modal, #note-modal-overlay, script, style, noscript')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    let occurrenceCount = 0;
    
    for (const textNode of textNodes) {
      const text = textNode.nodeValue;
      let startIndex = 0;
      
      while ((startIndex = text.indexOf(searchText, startIndex)) !== -1) {
        if (occurrenceCount === targetIndex) {
          try {
            const range = document.createRange();
            range.setStart(textNode, startIndex);
            range.setEnd(textNode, startIndex + searchText.length);
            
            const span = document.createElement('span');
            span.className = 'note-highlight ' + (note.color || 'yellow');
            span.dataset.noteId = note.id;
            span.dataset.text = searchText;
            span.title = note.comment || '点击查看笔记';
            
            range.surroundContents(span);
            return true;
          } catch (e) {
            console.warn('包裹文本失败:', e);
          }
        }
        occurrenceCount++;
        startIndex += searchText.length;
      }
    }
    
    return findAndHighlightAcrossNodes(searchText, note, textNodes, targetIndex - occurrenceCount);
  }

  function findAndHighlightAcrossNodes(searchText, note, textNodes, skipCount) {
    const searchChars = searchText.replace(/\s+/g, '');
    if (searchChars.length < 3) return false;
    
    let matchCount = 0;
    
    for (let i = 0; i < textNodes.length; i++) {
      const combinedText = [];
      const nodesToWrap = [];
      let charCount = 0;
      
      for (let j = i; j < textNodes.length && charCount < searchChars.length + 20; j++) {
        const nodeText = textNodes[j].nodeValue.replace(/\s+/g, '');
        combinedText.push(nodeText);
        nodesToWrap.push(textNodes[j]);
        charCount += nodeText.length;
      }
      
      const fullText = combinedText.join('');
      let matchIndex = -1;
      let searchFrom = 0;
      
      while ((matchIndex = fullText.indexOf(searchChars, searchFrom)) !== -1) {
        if (matchCount === skipCount || skipCount < 0) {
          let remainingChars = matchIndex;
          let startNode = null;
          let startOffset = 0;
          
          for (const node of nodesToWrap) {
            const nodeLen = node.nodeValue.replace(/\s+/g, '').length;
            if (remainingChars < nodeLen) {
              startNode = node;
              startOffset = findOffsetInNode(node, remainingChars);
              break;
            }
            remainingChars -= nodeLen;
          }
          
          let endRemaining = matchIndex + searchChars.length;
          let endNode = null;
          let endOffset = 0;
          
          for (const node of nodesToWrap) {
            const nodeLen = node.nodeValue.replace(/\s+/g, '').length;
            if (endRemaining <= nodeLen) {
              endNode = node;
              endOffset = findOffsetInNode(node, endRemaining);
              break;
            }
            endRemaining -= nodeLen;
          }
          
          if (startNode && endNode) {
            try {
              const range = document.createRange();
              range.setStart(startNode, startOffset);
              range.setEnd(endNode, endOffset);
              
              const span = document.createElement('span');
              span.className = 'note-highlight ' + (note.color || 'yellow');
              span.dataset.noteId = note.id;
              span.dataset.text = searchText;
              span.title = note.comment || '点击查看笔记';
              
              range.surroundContents(span);
              return true;
            } catch (e) {
              break;
            }
          }
        }
        matchCount++;
        searchFrom = matchIndex + 1;
      }
    }
    
    return false;
  }

  function findOffsetInNode(node, charCount) {
    const text = node.nodeValue;
    let nonSpaceCount = 0;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char !== ' ' && char !== '\n' && char !== '\t' && char !== '\r') {
        nonSpaceCount++;
        if (nonSpaceCount > charCount) {
          return i;
        }
      }
    }
    
    return text.length;
  }

  function flashHighlight(noteId) {
    const highlight = document.querySelector(`.note-highlight[data-note-id="${noteId}"]`);
    if (!highlight) return false;
    
    highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    let flashCount = 0;
    const flashInterval = setInterval(() => {
      highlight.style.boxShadow = flashCount % 2 === 0 ? '0 0 10px 3px #ff9800' : 'none';
      flashCount++;
      
      if (flashCount >= 6) {
        clearInterval(flashInterval);
        highlight.style.boxShadow = 'none';
      }
    }, 200);
    
    return true;
  }

  function scrollToNote(noteId) {
    const highlight = document.querySelector(`.note-highlight[data-note-id="${noteId}"]`);
    if (!highlight) return false;
    
    highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }

  function updateHighlight(note) {
    const highlight = document.querySelector(`.note-highlight[data-note-id="${note.id}"]`);
    if (!highlight) return;
    
    if (note.color) {
      highlight.className = 'note-highlight ' + note.color;
    }
    if (note.comment !== undefined) {
      highlight.title = note.comment || '点击查看笔记';
    }
    
    const noteIndex = pageNotes.findIndex(n => n.id === note.id);
    if (noteIndex !== -1) {
      pageNotes[noteIndex] = { ...pageNotes[noteIndex], ...note };
    }
  }

  function removeHighlight(noteId) {
    const highlight = document.querySelector(`.note-highlight[data-note-id="${noteId}"]`);
    if (!highlight) return;
    
    const parent = highlight.parentNode;
    while (highlight.firstChild) {
      parent.insertBefore(highlight.firstChild, highlight);
    }
    parent.removeChild(highlight);
    parent.normalize();
    
    pageNotes = pageNotes.filter(n => n.id !== noteId);
  }

  function getAllHighlightIds() {
    const highlights = document.querySelectorAll('.note-highlight[data-note-id]');
    return Array.from(highlights).map(h => h.dataset.noteId);
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
