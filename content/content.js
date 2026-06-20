(function() {
  'use strict';

  let currentSelection = null;
  let currentRange = null;
  let selectedColor = 'yellow';
  let selectedDifficulty = 'medium';
  let pageNotes = [];

  function init() {
    createToolbar();
    createTooltip();
    createQuickAddModal();
    loadPageNotes();
    setupEventListeners();
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
      if (e.target.classList.contains('note-highlight')) {
        showNoteTooltip(e.target);
      } else {
        hideTooltip();
      }
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'addNoteFromSelection') {
        openQuickAddModal();
      } else if (message.action === 'highlightSelection') {
        highlightSelectedText(selectedColor);
      }
    });
  }

  function handleTextSelection(e) {
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0 && selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0);
      
      if (isInsideToolbar(e.target) || isInsideModal(e.target)) {
        return;
      }
      
      currentSelection = selection.toString().trim();
      currentRange = range.cloneRange();
      
      const rect = range.getBoundingClientRect();
      showToolbar(rect.left + window.scrollX, rect.top + window.scrollY - 45);
    } else {
      if (!isInsideToolbar(e.target) && !isInsideModal(e.target)) {
        hideToolbar();
      }
    }
  }

  function handleMouseDown(e) {
    if (!isInsideToolbar(e.target) && !isInsideModal(e.target)) {
      hideTooltip();
    }
  }

  function isInsideToolbar(element) {
    const toolbar = document.getElementById('note-toolbar');
    return toolbar.contains(element);
  }

  function isInsideModal(element) {
    const modal = document.getElementById('note-quick-add-modal');
    const overlay = document.getElementById('note-modal-overlay');
    return modal.contains(element) || overlay.contains(element);
  }

  function showToolbar(x, y) {
    const toolbar = document.getElementById('note-toolbar');
    toolbar.style.left = x + 'px';
    toolbar.style.top = y + 'px';
    toolbar.classList.add('visible');
  }

  function hideToolbar() {
    document.getElementById('note-toolbar').classList.remove('visible');
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
    
    const noteData = {
      text: currentSelection || '',
      comment: comment,
      tags: tags,
      difficulty: selectedDifficulty,
      color: selectedColor,
      pageTitle: document.title,
      url: window.location.href,
      timestamp: videoTime,
      selectionHtml: currentRange ? currentRange.toString() : '',
      createdAt: Date.now()
    };
    
    chrome.runtime.sendMessage({
      action: 'saveNote',
      note: noteData
    }, response => {
      if (response && response.success) {
        if (currentRange) {
          try {
            const span = document.createElement('span');
            span.className = 'note-highlight ' + selectedColor;
            span.dataset.noteId = response.note.id;
            span.dataset.text = currentSelection;
            span.title = comment || '点击查看笔记';
            currentRange.surroundContents(span);
          } catch (e) {
            console.warn('无法高亮文本:', e);
          }
        }
        
        pageNotes.push(response.note);
        closeQuickAddModal();
        window.getSelection().removeAllRanges();
      }
    });
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
    
    let html = `<div><strong>笔记:</strong> ${note.comment || '无备注'}</div>`;
    
    if (note.tags && note.tags.length > 0) {
      html += '<div class="tooltip-tags">';
      note.tags.forEach(tag => {
        html += `<span class="tooltip-tag">${tag}</span>`;
      });
      html += '</div>';
    }
    
    if (note.difficulty) {
      const diffText = { easy: '简单', medium: '中等', hard: '困难' }[note.difficulty] || note.difficulty;
      html += `<div class="tooltip-difficulty">难度: ${diffText}</div>`;
    }
    
    tooltip.innerHTML = html;
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + window.scrollX + 'px';
    tooltip.style.top = rect.bottom + window.scrollY + 8 + 'px';
    tooltip.classList.add('visible');
  }

  function hideTooltip() {
    document.getElementById('note-tooltip').classList.remove('visible');
  }

  function loadPageNotes() {
    chrome.runtime.sendMessage({
      action: 'getNotesByUrl',
      url: window.location.href
    }, response => {
      if (response && response.success) {
        pageNotes = response.notes;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
