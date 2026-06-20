const SidePanelApp = {
  state: {
    notes: [],
    courses: [],
    tags: [],
    currentTab: 'notes',
    currentCourseId: null,
    filters: {
      courseId: '',
      tag: '',
      status: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      search: ''
    }
  },

  init() {
    this.setupEventListeners();
    this.loadAllData();
    this.updatePageInfo();
    this.checkOpenTab();
  },

  setupEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    document.getElementById('btn-add-note').addEventListener('click', () => this.openNoteModal());
    document.getElementById('btn-modal-close').addEventListener('click', () => this.closeNoteModal());
    document.getElementById('btn-modal-cancel').addEventListener('click', () => this.closeNoteModal());
    document.getElementById('btn-modal-save').addEventListener('click', () => this.saveNoteFromModal());
    document.getElementById('note-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'note-modal-overlay') this.closeNoteModal();
    });

    document.getElementById('note-search').addEventListener('input', (e) => {
      this.state.filters.search = e.target.value;
      this.renderNotes();
    });

    document.getElementById('filter-course').addEventListener('change', (e) => {
      this.state.filters.courseId = e.target.value;
      this.renderReviewList();
    });

    document.getElementById('filter-tag').addEventListener('change', (e) => {
      this.state.filters.tag = e.target.value;
      this.renderReviewList();
    });

    document.getElementById('filter-status').addEventListener('change', (e) => {
      this.state.filters.status = e.target.value;
      this.renderReviewList();
    });

    document.getElementById('filter-sort').addEventListener('change', (e) => {
      const [sortBy, sortOrder] = e.target.value.split('-');
      this.state.filters.sortBy = sortBy;
      this.state.filters.sortOrder = sortOrder;
      this.renderReviewList();
    });

    document.getElementById('btn-export').addEventListener('click', () => this.exportNotes());
  },

  async loadAllData() {
    chrome.runtime.sendMessage({ action: 'getAllNotes' }, (response) => {
      if (response && response.success) {
        this.state.notes = response.notes;
        this.state.courses = response.courses;
        this.loadTags();
        this.renderAll();
      }
    });
  },

  async loadTags() {
    chrome.runtime.sendMessage({ action: 'getAllTags' }, (response) => {
      if (response && response.success) {
        this.state.tags = response.tags;
        this.renderTagFilters();
      }
    });
  },

  renderAll() {
    this.renderCourseFilters();
    this.renderTagFilters();
    this.renderNotes();
    this.renderReviewList();
    this.renderCourses();
  },

  switchTab(tabName) {
    this.state.currentTab = tabName;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    if (tabName === 'notes') {
      this.renderNotes();
    } else if (tabName === 'review') {
      this.renderReviewList();
    } else if (tabName === 'courses') {
      this.renderCourses();
    }
  },

  updatePageInfo() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        document.getElementById('current-page-title').textContent = tabs[0].title || '未知页面';
      }
    });
  },

  checkOpenTab() {
    chrome.storage.local.get('openTab', (result) => {
      if (result.openTab) {
        this.switchTab(result.openTab);
        chrome.storage.local.remove('openTab');
      }
    });
  },

  renderCourseFilters() {
    const select = document.getElementById('filter-course');
    select.innerHTML = '<option value="">全部课程</option>';
    this.state.courses.forEach(course => {
      const option = document.createElement('option');
      option.value = course.id;
      option.textContent = course.title;
      select.appendChild(option);
    });
  },

  renderTagFilters() {
    const select = document.getElementById('filter-tag');
    select.innerHTML = '<option value="">全部标签</option>';
    this.state.tags.forEach(tag => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      select.appendChild(option);
    });
  },

  getFilteredNotes() {
    let notes = [...this.state.notes];
    const f = this.state.filters;

    if (f.search) {
      const searchLower = f.search.toLowerCase();
      notes = notes.filter(n => 
        (n.text && n.text.toLowerCase().includes(searchLower)) ||
        (n.comment && n.comment.toLowerCase().includes(searchLower)) ||
        (n.tags && n.tags.some(t => t.toLowerCase().includes(searchLower)))
      );
    }

    if (f.courseId) {
      notes = notes.filter(n => n.courseId === f.courseId);
    }

    if (f.tag) {
      notes = notes.filter(n => n.tags && n.tags.includes(f.tag));
    }

    if (f.status === 'mastered') {
      notes = notes.filter(n => n.mastered === true);
    } else if (f.status === 'unmastered') {
      notes = notes.filter(n => n.mastered !== true);
    } else if (f.status === 'wrong') {
      notes = notes.filter(n => n.isWrong === true);
    }

    notes.sort((a, b) => {
      if (f.sortBy === 'createdAt') {
        return f.sortOrder === 'asc' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
      }
      return b.createdAt - a.createdAt;
    });

    return notes;
  },

  renderNotes() {
    const listEl = document.getElementById('notes-list');
    let notes = this.getFilteredNotes();

    notes = notes.filter(n => {
      return true;
    });

    if (notes.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <p>暂无笔记</p>
          <p class="hint">选中页面文字后点击"添加笔记"开始记录</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = notes.map(note => this.createNoteCardHTML(note)).join('');
    
    listEl.querySelectorAll('.note-card').forEach(card => {
      const noteId = card.dataset.noteId;
      
      card.querySelector('.action-btn.edit')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editNote(noteId);
      });
      
      card.querySelector('.action-btn.delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteNote(noteId);
      });
      
      card.querySelector('.action-btn.mastered')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMastered(noteId);
      });
      
      card.querySelector('.action-btn.wrong')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleWrong(noteId);
      });
      
      card.addEventListener('click', () => {
        this.openNotePage(noteId);
      });
    });
  },

  createNoteCardHTML(note) {
    const course = this.state.courses.find(c => c.id === note.courseId);
    const diffText = { easy: '简单', medium: '中等', hard: '困难' }[note.difficulty] || '';
    const dateStr = this.formatDate(note.createdAt);
    
    let tagsHTML = '';
    if (note.tags && note.tags.length > 0) {
      tagsHTML = '<div class="note-tags">' + 
        note.tags.map(t => `<span class="note-tag">${t}</span>`).join('') + 
        '</div>';
    }

    const diffHTML = note.difficulty ? 
      `<span class="note-difficulty ${note.difficulty}">${diffText}</span>` : '';

    const masteredText = note.mastered ? '取消掌握' : '标记掌握';
    const wrongText = note.isWrong ? '移出错题' : '加入错题';

    let reminderHTML = '';
    if (note.reviewReminder && note.reviewReminder > Date.now()) {
      const reminderStr = this.formatReminderTime(note.reviewReminder);
      reminderHTML = `<span class="note-reminder">⏰ ${reminderStr}</span>`;
    }

    return `
      <div class="note-card ${note.mastered ? 'mastered' : ''} ${note.isWrong ? 'wrong' : ''}" data-note-id="${note.id}">
        <div class="note-text">${this.escapeHtml(note.text || note.comment || '无内容')}</div>
        ${note.comment && note.text ? `<div class="note-comment">${this.escapeHtml(note.comment)}</div>` : ''}
        ${tagsHTML}
        <div class="note-meta">
          <span>${course ? course.title : '未分类'}</span>
          <span>${dateStr}</span>
        </div>
        <div class="note-meta" style="margin-top: 6px;">
          <span>${diffHTML}${reminderHTML}</span>
          <div class="note-actions">
            <button class="action-btn edit">编辑</button>
            <button class="action-btn mastered">${masteredText}</button>
            <button class="action-btn wrong">${wrongText}</button>
            <button class="action-btn delete">删除</button>
          </div>
        </div>
      </div>
    `;
  },

  renderReviewList() {
    const listEl = document.getElementById('review-list');
    let notes = this.getFilteredNotes();

    if (notes.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <p>暂无待复习内容</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = notes.map(note => this.createNoteCardHTML(note)).join('');
    
    listEl.querySelectorAll('.note-card').forEach(card => {
      const noteId = card.dataset.noteId;
      
      card.querySelector('.action-btn.edit')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editNote(noteId);
      });
      
      card.querySelector('.action-btn.delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteNote(noteId);
      });
      
      card.querySelector('.action-btn.mastered')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMastered(noteId);
      });
      
      card.querySelector('.action-btn.wrong')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleWrong(noteId);
      });
    });
  },

  renderCourses() {
    const listEl = document.getElementById('courses-list');

    if (this.state.currentCourseId) {
      this.renderCourseDetail();
      return;
    }

    if (this.state.courses.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <p>暂无课程</p>
          <p class="hint">添加笔记后会自动创建课程</p>
        </div>
      `;
      return;
    }

    const courseNoteCounts = {};
    this.state.notes.forEach(note => {
      if (note.courseId) {
        courseNoteCounts[note.courseId] = (courseNoteCounts[note.courseId] || 0) + 1;
      }
    });

    listEl.innerHTML = this.state.courses.map(course => {
      const count = courseNoteCounts[course.id] || 0;
      return `
      <div class="course-card" data-course-id="${course.id}">
        <h3>${this.escapeHtml(course.title)}</h3>
        <div class="course-meta">
          <span>${this.formatDate(course.createdAt)}</span>
          <span class="course-note-count">${count} 条笔记</span>
        </div>
      </div>
    `;
    }).join('');

    listEl.querySelectorAll('.course-card').forEach(card => {
      card.addEventListener('click', () => {
        this.state.currentCourseId = card.dataset.courseId;
        this.renderCourseDetail();
      });
    });
  },

  renderCourseDetail() {
    const listEl = document.getElementById('courses-list');
    const course = this.state.courses.find(c => c.id === this.state.currentCourseId);
    const courseNotes = this.state.notes.filter(n => n.courseId === this.state.currentCourseId);

    if (!course) {
      this.state.currentCourseId = null;
      this.renderCourses();
      return;
    }

    const notesByDate = {};
    courseNotes.forEach(note => {
      const date = new Date(note.createdAt).toLocaleDateString('zh-CN');
      if (!notesByDate[date]) notesByDate[date] = [];
      notesByDate[date].push(note);
    });

    let notesHTML = '';
    Object.keys(notesByDate).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
      notesHTML += `<div style="margin: 12px 0 8px; font-size: 11px; color: #999;">${date}</div>`;
      notesByDate[date].forEach(note => {
        notesHTML += this.createNoteCardHTML(note);
      });
    });

    listEl.innerHTML = `
      <button class="btn-back" id="btn-back-courses">← 返回课程列表</button>
      <div class="course-detail">
        <h2>${this.escapeHtml(course.title)}</h2>
        <div class="course-info">共 ${courseNotes.length} 条笔记</div>
      </div>
      <div class="notes-list">
        ${notesHTML || '<div class="empty-state"><p>该课程暂无笔记</p></div>'}
      </div>
    `;

    document.getElementById('btn-back-courses').addEventListener('click', () => {
      this.state.currentCourseId = null;
      this.renderCourses();
    });

    listEl.querySelectorAll('.note-card').forEach(card => {
      const noteId = card.dataset.noteId;
      
      card.querySelector('.action-btn.edit')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editNote(noteId);
      });
      
      card.querySelector('.action-btn.delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteNote(noteId);
      });
      
      card.querySelector('.action-btn.mastered')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMastered(noteId);
      });
      
      card.querySelector('.action-btn.wrong')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleWrong(noteId);
      });
    });
  },

  openNoteModal(note = null) {
    const modal = document.getElementById('note-modal-overlay');
    const title = document.getElementById('modal-title');
    
    document.getElementById('modal-text-preview').textContent = note ? (note.text || '') : '从页面选中文字';
    document.getElementById('modal-comment').value = note ? (note.comment || '') : '';
    document.getElementById('modal-tags').value = note ? (note.tags ? note.tags.join(', ') : '') : '';
    document.getElementById('modal-difficulty').value = note ? (note.difficulty || 'medium') : 'medium';
    
    const color = note ? (note.color || 'yellow') : 'yellow';
    document.querySelector(`input[name="modal-color"][value="${color}"]`).checked = true;

    let reminderValue = '';
    if (note && note.reviewReminder) {
      const diff = note.reviewReminder - Date.now();
      if (diff > 0) {
        if (diff <= 3600000) reminderValue = '1h';
        else if (diff <= 86400000) reminderValue = '1d';
        else if (diff <= 259200000) reminderValue = '3d';
        else if (diff <= 604800000) reminderValue = '7d';
      }
    }
    const reminderRadio = document.querySelector(`input[name="modal-reminder"][value="${reminderValue}"]`);
    if (reminderRadio) reminderRadio.checked = true;

    title.textContent = note ? '编辑笔记' : '新建笔记';
    modal.dataset.noteId = note ? note.id : '';
    
    modal.classList.add('visible');
  },

  closeNoteModal() {
    document.getElementById('note-modal-overlay').classList.remove('visible');
  },

  saveNoteFromModal() {
    const modal = document.getElementById('note-modal-overlay');
    const noteId = modal.dataset.noteId;
    
    const comment = document.getElementById('modal-comment').value.trim();
    const tagsStr = document.getElementById('modal-tags').value.trim();
    const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(t => t) : [];
    const difficulty = document.getElementById('modal-difficulty').value;
    const color = document.querySelector('input[name="modal-color"]:checked').value;
    const reminderValue = document.querySelector('input[name="modal-reminder"]:checked').value;
    
    let reviewReminder = null;
    if (reminderValue) {
      const now = Date.now();
      switch (reminderValue) {
        case '1h': reviewReminder = now + 3600000; break;
        case '1d': reviewReminder = now + 86400000; break;
        case '3d': reviewReminder = now + 259200000; break;
        case '7d': reviewReminder = now + 604800000; break;
      }
    }

    const noteData = {
      comment,
      tags,
      difficulty,
      color,
      reviewReminder
    };

    if (noteId) {
      noteData.id = noteId;
      this.saveNoteAndReminder(noteData);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          noteData.pageTitle = tabs[0].title;
          noteData.url = tabs[0].url;
          noteData.text = document.getElementById('modal-text-preview').textContent;
          this.saveNoteAndReminder(noteData);
        }
      });
    }
  },

  saveNoteAndReminder(noteData) {
    chrome.runtime.sendMessage({ action: 'saveNote', note: noteData }, (response) => {
      if (response && response.success) {
        if (noteData.reviewReminder !== undefined && response.note && response.note.id) {
          chrome.runtime.sendMessage({
            action: 'setReviewReminder',
            noteId: response.note.id,
            reminderTime: noteData.reviewReminder
          });
        }
        this.closeNoteModal();
        this.loadAllData();
      }
    });
  },

  editNote(noteId) {
    const note = this.state.notes.find(n => n.id === noteId);
    if (note) {
      this.openNoteModal(note);
    }
  },

  deleteNote(noteId) {
    if (confirm('确定要删除这条笔记吗？')) {
      chrome.runtime.sendMessage({ action: 'deleteNote', noteId }, (response) => {
        if (response && response.success) {
          this.loadAllData();
        }
      });
    }
  },

  toggleMastered(noteId) {
    const note = this.state.notes.find(n => n.id === noteId);
    if (note) {
      chrome.runtime.sendMessage({ 
        action: 'updateNoteMastery', 
        noteId, 
        mastered: !note.mastered 
      }, (response) => {
        if (response && response.success) {
          this.loadAllData();
        }
      });
    }
  },

  toggleWrong(noteId) {
    const note = this.state.notes.find(n => n.id === noteId);
    if (note) {
      chrome.runtime.sendMessage({ 
        action: 'updateNoteWrong', 
        noteId, 
        isWrong: !note.isWrong 
      }, (response) => {
        if (response && response.success) {
          this.loadAllData();
        }
      });
    }
  },

  openNotePage(noteId) {
    const note = this.state.notes.find(n => n.id === noteId);
    if (note && note.url) {
      chrome.tabs.create({ url: note.url });
    }
  },

  exportNotes() {
    const format = document.querySelector('input[name="export-format"]:checked').value;
    const scope = document.getElementById('export-scope').value;
    const includeSource = document.getElementById('export-include-source').checked;
    const includeTags = document.getElementById('export-include-tags').checked;
    const includeDifficulty = document.getElementById('export-include-difficulty').checked;

    let notes = [...this.state.notes];

    if (scope === 'current-course') {
      const courseId = this.state.currentCourseId || this.state.filters.courseId;
      if (courseId) {
        notes = notes.filter(n => n.courseId === courseId);
      }
    } else if (scope === 'current-page') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          notes = notes.filter(n => n.url === tabs[0].url);
          this.doExport(notes, format, includeSource, includeTags, includeDifficulty);
        }
      });
      return;
    }

    this.doExport(notes, format, includeSource, includeTags, includeDifficulty);
  },

  doExport(notes, format, includeSource, includeTags, includeDifficulty) {
    let content = '';
    const filename = `课程笔记_${this.formatDateForFilename()}`;

    if (format === 'markdown') {
      content = this.exportMarkdown(notes, includeSource, includeTags, includeDifficulty);
      this.downloadFile(content, `${filename}.md`, 'text/markdown');
    } else if (format === 'text') {
      content = this.exportText(notes, includeSource, includeTags, includeDifficulty);
      this.downloadFile(content, `${filename}.txt`, 'text/plain');
    } else if (format === 'print') {
      content = this.exportPrint(notes, includeSource, includeTags, includeDifficulty);
      const printWindow = window.open('', '_blank');
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.print();
    }
  },

  exportMarkdown(notes, includeSource, includeTags, includeDifficulty) {
    const courses = this.groupNotesByCourse(notes);
    let md = '# 课程笔记\n\n';

    courses.forEach(course => {
      md += `## ${course.title}\n\n`;
      
      course.notes.forEach(note => {
        if (note.text) {
          md += `> ${note.text.replace(/\n/g, '\n> ')}\n\n`;
        }
        if (note.comment) {
          md += `${note.comment}\n\n`;
        }
        
        const metaParts = [];
        if (includeTags && note.tags && note.tags.length > 0) {
          metaParts.push(note.tags.map(t => `\`${t}\``).join(' '));
        }
        if (includeDifficulty && note.difficulty) {
          const diffText = { easy: '简单', medium: '中等', hard: '困难' }[note.difficulty];
          metaParts.push(`难度: ${diffText}`);
        }
        if (metaParts.length > 0) {
          md += `*${metaParts.join(' | ')}*\n\n`;
        }
        
        if (includeSource && note.url) {
          md += `[来源](${note.url}) - ${note.pageTitle || ''}\n\n`;
        }
        
        md += '---\n\n';
      });
    });

    return md;
  },

  exportText(notes, includeSource, includeTags, includeDifficulty) {
    const courses = this.groupNotesByCourse(notes);
    let text = '';

    courses.forEach(course => {
      text += `【${course.title}】\n${'='.repeat(40)}\n\n`;
      
      course.notes.forEach((note, index) => {
        text += `笔记 ${index + 1} (${this.formatDate(note.createdAt)})\n`;
        
        if (note.text) {
          text += `  内容: ${note.text}\n`;
        }
        if (note.comment) {
          text += `  备注: ${note.comment}\n`;
        }
        if (includeTags && note.tags && note.tags.length > 0) {
          text += `  标签: ${note.tags.join(', ')}\n`;
        }
        if (includeDifficulty && note.difficulty) {
          const diffText = { easy: '简单', medium: '中等', hard: '困难' }[note.difficulty];
          text += `  难度: ${diffText}\n`;
        }
        if (includeSource && note.url) {
          text += `  来源: ${note.url}\n`;
          if (note.pageTitle) {
            text += `  标题: ${note.pageTitle}\n`;
          }
        }
        text += '\n';
      });
      
      text += '\n';
    });

    return text;
  },

  exportPrint(notes, includeSource, includeTags, includeDifficulty) {
    const courses = this.groupNotesByCourse(notes);
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>课程笔记</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; line-height: 1.6; color: #333; }
          h1 { color: #2e7d32; border-bottom: 2px solid #4caf50; padding-bottom: 10px; }
          h2 { color: #388e3c; margin-top: 30px; border-bottom: 1px solid #c8e6c9; padding-bottom: 5px; }
          .note { margin: 15px 0; padding: 15px; border-left: 3px solid #4caf50; background: #f8f8f8; }
          .note-text { font-style: italic; color: #555; }
          .note-comment { margin-top: 8px; }
          .note-meta { margin-top: 8px; font-size: 12px; color: #888; }
          .tag { display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 4px; }
          .source { margin-top: 8px; font-size: 12px; color: #666; }
          .source a { color: #1976d2; text-decoration: none; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>课程笔记</h1>
    `;

    courses.forEach(course => {
      html += `<h2>${this.escapeHtml(course.title)}</h2>\n`;
      
      course.notes.forEach(note => {
        html += '<div class="note">\n';
        
        if (note.text) {
          html += `<div class="note-text">${this.escapeHtml(note.text)}</div>\n`;
        }
        if (note.comment) {
          html += `<div class="note-comment">${this.escapeHtml(note.comment)}</div>\n`;
        }
        
        if (includeTags && note.tags && note.tags.length > 0) {
          html += '<div class="note-meta">';
          note.tags.forEach(tag => {
            html += `<span class="tag">${this.escapeHtml(tag)}</span>`;
          });
          html += '</div>\n';
        }
        
        if (includeDifficulty && note.difficulty) {
          const diffText = { easy: '简单', medium: '中等', hard: '困难' }[note.difficulty];
          html += `<div class="note-meta">难度: ${diffText}</div>\n`;
        }
        
        if (includeSource && note.url) {
          html += `<div class="source">来源: <a href="${note.url}">${this.escapeHtml(note.pageTitle || note.url)}</a></div>\n`;
        }
        
        html += '</div>\n';
      });
    });

    html += '</body></html>';
    return html;
  },

  groupNotesByCourse(notes) {
    const courseMap = {};
    
    notes.forEach(note => {
      const courseId = note.courseId || 'uncategorized';
      if (!courseMap[courseId]) {
        const course = this.state.courses.find(c => c.id === courseId);
        courseMap[courseId] = {
          id: courseId,
          title: course ? course.title : '未分类',
          notes: []
        };
      }
      courseMap[courseId].notes.push(note);
    });

    return Object.values(courseMap).sort((a, b) => b.notes.length - a.notes.length);
  },

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    
    return date.toLocaleDateString('zh-CN');
  },

  formatDateForFilename() {
    const date = new Date();
    return date.getFullYear() + 
      String(date.getMonth() + 1).padStart(2, '0') + 
      String(date.getDate()).padStart(2, '0');
  },

  formatReminderTime(timestamp) {
    const diff = timestamp - Date.now();
    if (diff <= 0) return '已过期';
    if (diff < 3600000) return Math.ceil(diff / 60000) + '分钟后';
    if (diff < 86400000) return Math.ceil(diff / 3600000) + '小时后';
    return Math.ceil(diff / 86400000) + '天后';
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  SidePanelApp.init();
});
