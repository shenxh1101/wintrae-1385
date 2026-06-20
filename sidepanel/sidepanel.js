const SidePanelApp = {
  state: {
    notes: [],
    courses: [],
    tags: [],
    currentTab: 'notes',
    currentCourseId: null,
    selectedNoteIds: [],
    reviewView: 'plan',
    selectedPlanDay: null,
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

    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.reviewView = btn.dataset.view;
        this.state.selectedPlanDay = null;
        document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
        this.renderReviewList();
      });
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

    document.getElementById('select-all-notes').addEventListener('change', () => {
      this.toggleSelectAllNotes();
    });

    document.getElementById('batch-mastered').addEventListener('click', () => {
      this.batchMarkMastered();
    });

    document.getElementById('batch-postpone').addEventListener('click', () => {
      this.batchPostpone(1);
    });
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
    
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.openTab) {
        if (changes.openTab.newValue) {
          this.switchTab(changes.openTab.newValue);
          chrome.storage.local.remove('openTab');
        }
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
      } else if (f.sortBy === 'reminder') {
        const aTime = a.reviewReminder ? new Date(a.reviewReminder).getTime() : Infinity;
        const bTime = b.reviewReminder ? new Date(b.reviewReminder).getTime() : Infinity;
        return f.sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
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

  createNoteCardHTML(note, options = {}) {
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

    let reviewBadgeHTML = '';
    if (note.reviewCount && note.reviewCount > 0) {
      const hotClass = note.reviewCount >= 3 ? ' hot' : '';
      reviewBadgeHTML = `<span class="note-review-badge${hotClass}">复习${note.reviewCount}次</span>`;
    }

    const checkboxHTML = options.showCheckbox ? `
      <label class="note-checkbox" style="position: absolute; top: 10px; right: 10px; z-index: 2;">
        <input type="checkbox" ${options.isSelected ? 'checked' : ''}>
      </label>
    ` : '';

    return `
      <div class="note-card ${note.mastered ? 'mastered' : ''} ${note.isWrong ? 'wrong' : ''}" data-note-id="${note.id}" style="position: relative;">
        ${checkboxHTML}
        <div class="note-text">${this.escapeHtml(note.text || note.comment || '无内容')}</div>
        ${note.comment && note.text ? `<div class="note-comment">${this.escapeHtml(note.comment)}</div>` : ''}
        ${tagsHTML}
        <div class="note-meta">
          <span>${course ? course.title : '未分类'}</span>
          <span>${dateStr}</span>
        </div>
        <div class="note-meta" style="margin-top: 6px;">
          <span>${diffHTML}${reminderHTML}${reviewBadgeHTML}</span>
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
    const planEl = document.getElementById('review-plan');
    const listEl = document.getElementById('review-list');
    const batchActionsEl = document.getElementById('review-batch-actions');
    const view = this.state.reviewView;

    if (view === 'plan') {
      this.renderReviewPlan(planEl, listEl, batchActionsEl);
    } else if (view === 'wrong') {
      this.renderWrongReview(planEl, listEl, batchActionsEl);
    } else {
      this.renderReviewListView(planEl, listEl, batchActionsEl);
    }
  },

  renderReviewPlan(planEl, listEl, batchActionsEl) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let allNotes = this.getFilteredNotes();
    const unmasteredNotes = allNotes.filter(n => !n.mastered);

    const dayMap = {};
    const overdueNotes = [];
    
    unmasteredNotes.forEach(note => {
      if (!note.reviewReminder) return;
      const reminderDate = new Date(note.reviewReminder);
      if (reminderDate < todayStart) {
        overdueNotes.push(note);
      } else {
        const dayKey = reminderDate.getFullYear() + '-' +
          String(reminderDate.getMonth() + 1).padStart(2, '0') + '-' +
          String(reminderDate.getDate()).padStart(2, '0');
        if (!dayMap[dayKey]) dayMap[dayKey] = [];
        dayMap[dayKey].push(note);
      }
    });

    const noReminderNotes = unmasteredNotes.filter(n => !n.reviewReminder);
    
    let planHTML = '';
    
    if (overdueNotes.length > 0) {
      planHTML += `
        <div class="plan-day overdue ${this.state.selectedPlanDay === 'overdue' ? 'selected' : ''}" data-day="overdue">
          <span class="plan-day-label">已过期</span>
          <span class="plan-day-date">需立即复习</span>
          <span class="plan-day-count">${overdueNotes.length} 条</span>
        </div>
      `;
    }

    const todayKey = todayStart.getFullYear() + '-' +
      String(todayStart.getMonth() + 1).padStart(2, '0') + '-' +
      String(todayStart.getDate()).padStart(2, '0');
    
    const todayNotes = dayMap[todayKey] || [];
    planHTML += `
      <div class="plan-day today ${this.state.selectedPlanDay === todayKey ? 'selected' : ''}" data-day="${todayKey}">
        <span class="plan-day-label">今天</span>
        <span class="plan-day-date">${now.getMonth() + 1}/${now.getDate()}</span>
        <span class="plan-day-count">${todayNotes.length} 条</span>
      </div>
    `;

    for (let i = 1; i <= 6; i++) {
      const d = new Date(todayStart);
      d.setDate(d.getDate() + i);
      const dayKey = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      const dayNotes = dayMap[dayKey] || [];
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const weekday = weekdays[d.getDay()];
      
      planHTML += `
        <div class="plan-day future ${this.state.selectedPlanDay === dayKey ? 'selected' : ''}" data-day="${dayKey}">
          <span class="plan-day-label">${weekday}</span>
          <span class="plan-day-date">${d.getMonth() + 1}/${d.getDate()}</span>
          <span class="plan-day-count">${dayNotes.length} 条</span>
        </div>
      `;
    }

    if (noReminderNotes.length > 0) {
      planHTML += `
        <div class="plan-day ${this.state.selectedPlanDay === 'noReminder' ? 'selected' : ''}" data-day="noReminder">
          <span class="plan-day-label">未设提醒</span>
          <span class="plan-day-date">待安排</span>
          <span class="plan-day-count">${noReminderNotes.length} 条</span>
        </div>
      `;
    }

    planEl.innerHTML = planHTML;

    planEl.querySelectorAll('.plan-day').forEach(el => {
      el.addEventListener('click', () => {
        const day = el.dataset.day;
        this.state.selectedPlanDay = this.state.selectedPlanDay === day ? null : day;
        this.renderReviewList();
      });
    });

    let filteredNotes;
    if (this.state.selectedPlanDay === 'overdue') {
      filteredNotes = overdueNotes;
    } else if (this.state.selectedPlanDay === 'noReminder') {
      filteredNotes = noReminderNotes;
    } else if (this.state.selectedPlanDay) {
      filteredNotes = dayMap[this.state.selectedPlanDay] || [];
    } else {
      filteredNotes = unmasteredNotes;
    }

    if (filteredNotes.length === 0) {
      batchActionsEl.style.display = 'none';
      listEl.innerHTML = `<div class="empty-state"><p>${this.state.selectedPlanDay ? '当天暂无复习任务' : '暂无待复习内容'}</p></div>`;
      return;
    }

    batchActionsEl.style.display = 'flex';
    document.getElementById('selected-count').textContent = `已选 ${this.state.selectedNoteIds.length} 条`;
    const allSelected = filteredNotes.every(n => this.state.selectedNoteIds.includes(n.id));
    document.getElementById('select-all-notes').checked = allSelected;

    listEl.innerHTML = filteredNotes.map(note => 
      this.createNoteCardHTML(note, { showCheckbox: true, isSelected: this.state.selectedNoteIds.includes(note.id) })
    ).join('');

    this.bindNoteCardEvents(listEl);
  },

  renderWrongReview(planEl, listEl, batchActionsEl) {
    const wrongNotes = this.state.notes.filter(n => n.isWrong);
    
    planEl.innerHTML = '';
    
    if (wrongNotes.length === 0) {
      batchActionsEl.style.display = 'none';
      listEl.innerHTML = `
        <div class="wrong-review-header">
          <span class="wrong-icon">❌</span>
          <span class="wrong-title">错题复习</span>
          <span class="wrong-count">0 条</span>
        </div>
        <div class="empty-state"><p>暂无错题</p></div>
      `;
      return;
    }

    const unmasteredWrong = wrongNotes.filter(n => !n.mastered);
    const masteredWrong = wrongNotes.filter(n => n.mastered);
    
    let html = `
      <div class="wrong-review-header">
        <span class="wrong-icon">❌</span>
        <span class="wrong-title">错题复习</span>
        <span class="wrong-count">${wrongNotes.length} 条</span>
      </div>
    `;

    if (unmasteredWrong.length > 0) {
      html += `
        <div class="review-group overdue">
          <div class="review-group-header">
            <span class="review-group-title">未掌握</span>
            <span class="review-group-count">${unmasteredWrong.length} 条</span>
          </div>
          <div class="review-group-notes">
            ${unmasteredWrong.map(note => this.createNoteCardHTML(note)).join('')}
          </div>
        </div>
      `;
    }

    if (masteredWrong.length > 0) {
      html += `
        <div class="review-group">
          <div class="review-group-header">
            <span class="review-group-title">已掌握</span>
            <span class="review-group-count">${masteredWrong.length} 条</span>
          </div>
          <div class="review-group-notes">
            ${masteredWrong.map(note => this.createNoteCardHTML(note)).join('')}
          </div>
        </div>
      `;
    }

    batchActionsEl.style.display = 'none';
    listEl.innerHTML = html;
    this.bindNoteCardEvents(listEl);
  },

  renderReviewListView(planEl, listEl, batchActionsEl) {
    planEl.innerHTML = '';
    let notes = this.getFilteredNotes();

    if (notes.length === 0) {
      batchActionsEl.style.display = 'none';
      listEl.innerHTML = '<div class="empty-state"><p>暂无待复习内容</p></div>';
      return;
    }

    batchActionsEl.style.display = 'flex';
    document.getElementById('selected-count').textContent = `已选 ${this.state.selectedNoteIds.length} 条`;
    const allSelected = notes.every(n => this.state.selectedNoteIds.includes(n.id));
    document.getElementById('select-all-notes').checked = allSelected;

    const groups = this.groupNotesByReminder(notes);
    const groupOrder = ['overdue', 'today', 'later', 'noReminder'];
    const groupTitles = {
      overdue: '已过期',
      today: '今天',
      later: '以后',
      noReminder: '未设置提醒'
    };

    let html = '';
    groupOrder.forEach(groupKey => {
      const groupNotes = groups[groupKey] || [];
      if (groupNotes.length === 0) return;
      
      html += `
        <div class="review-group ${groupKey}">
          <div class="review-group-header">
            <span class="review-group-title">${groupTitles[groupKey]}</span>
            <span class="review-group-count">${groupNotes.length} 条</span>
          </div>
          <div class="review-group-notes">
            ${groupNotes.map(note => this.createNoteCardHTML(note, { showCheckbox: true, isSelected: this.state.selectedNoteIds.includes(note.id) })).join('')}
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;
    this.bindNoteCardEvents(listEl);
  },

  bindNoteCardEvents(container) {
    container.querySelectorAll('.note-card').forEach(card => {
      const noteId = card.dataset.noteId;
      
      const checkbox = card.querySelector('.note-checkbox input');
      if (checkbox) {
        checkbox.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleNoteSelection(noteId);
        });
      }
      
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

  groupNotesByReminder(notes) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    
    const groups = {
      overdue: [],
      today: [],
      later: [],
      noReminder: []
    };

    notes.forEach(note => {
      if (!note.reviewReminder) {
        groups.noReminder.push(note);
        return;
      }
      
      const reminderDate = new Date(note.reviewReminder);
      if (reminderDate < todayStart) {
        groups.overdue.push(note);
      } else if (reminderDate < todayEnd) {
        groups.today.push(note);
      } else {
        groups.later.push(note);
      }
    });

    const sortByReminder = (a, b) => {
      const aTime = a.reviewReminder ? new Date(a.reviewReminder).getTime() : Infinity;
      const bTime = b.reviewReminder ? new Date(b.reviewReminder).getTime() : Infinity;
      return aTime - bTime;
    };

    groups.overdue.sort(sortByReminder);
    groups.today.sort(sortByReminder);
    groups.later.sort(sortByReminder);

    return groups;
  },

  toggleNoteSelection(noteId) {
    const index = this.state.selectedNoteIds.indexOf(noteId);
    if (index === -1) {
      this.state.selectedNoteIds.push(noteId);
    } else {
      this.state.selectedNoteIds.splice(index, 1);
    }
    this.renderReviewList();
  },

  toggleSelectAllNotes() {
    const notes = this.getFilteredNotes();
    const allSelected = notes.every(n => this.state.selectedNoteIds.includes(n.id));
    
    if (allSelected) {
      this.state.selectedNoteIds = [];
    } else {
      this.state.selectedNoteIds = notes.map(n => n.id);
    }
    this.renderReviewList();
  },

  async batchMarkMastered() {
    if (this.state.selectedNoteIds.length === 0) return;
    
    const count = this.state.selectedNoteIds.length;
    const ids = [...this.state.selectedNoteIds];
    
    for (const noteId of ids) {
      this.toggleMastered(noteId, true);
    }
    
    this.state.selectedNoteIds = [];
    this.showToast(`已将 ${count} 条标记为已掌握`, 'success');
    this.loadAllData();
  },

  async batchPostpone(days = 1) {
    if (this.state.selectedNoteIds.length === 0) return;
    
    const count = this.state.selectedNoteIds.length;
    const ids = [...this.state.selectedNoteIds];
    
    for (const noteId of ids) {
      const note = this.state.notes.find(n => n.id === noteId);
      if (note) {
        let newTime;
        if (note.reviewReminder) {
          newTime = new Date(note.reviewReminder);
          newTime.setDate(newTime.getDate() + days);
        } else {
          newTime = new Date();
          newTime.setDate(newTime.getDate() + days);
          newTime.setHours(20, 0, 0, 0);
        }
        this.setReviewReminder(noteId, newTime.getTime());
      }
    }
    
    this.showToast(`已将 ${count} 条提醒顺延 ${days} 天`, 'success');
    this.loadAllData();
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
      
      card.addEventListener('click', () => {
        this.openNotePage(noteId);
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

  setReviewReminder(noteId, reminderTime) {
    chrome.runtime.sendMessage({
      action: 'setReviewReminder',
      noteId,
      reminderTime
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

  toggleMastered(noteId, forceValue) {
    const note = this.state.notes.find(n => n.id === noteId);
    if (note) {
      const newValue = typeof forceValue === 'boolean' ? forceValue : !note.mastered;
      chrome.runtime.sendMessage({ 
        action: 'updateNoteMastery', 
        noteId, 
        mastered: newValue 
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
    if (!note || !note.url) return;
    
    chrome.tabs.query({ url: note.url }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const tab = tabs[0];
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
        
        chrome.tabs.sendMessage(tab.id, { 
          action: 'flashHighlight', 
          noteId: noteId 
        }, (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { 
                action: 'flashHighlight', 
                noteId: noteId 
              }, (resp2) => {
                if (chrome.runtime.lastError || !resp2 || !resp2.success) {
                  this.showToast('无法定位到高亮位置，页面可能已变化', 'warning');
                }
              });
            }, 500);
          }
        });
      } else {
        chrome.tabs.create({ url: note.url }, (newTab) => {
          const tabId = newTab.id;
          let attempts = 0;
          const maxAttempts = 20;
          
          const checkAndFlash = () => {
            attempts++;
            if (attempts > maxAttempts) {
              this.showToast('页面加载完成，但未找到对应的高亮位置', 'warning');
              return;
            }
            
            chrome.tabs.sendMessage(tabId, { 
              action: 'flashHighlight', 
              noteId: noteId 
            }, (response) => {
              if (chrome.runtime.lastError || !response || !response.success) {
                setTimeout(checkAndFlash, 500);
              }
            });
          };
          
          setTimeout(checkAndFlash, 1000);
        });
      }
    });
  },

  showToast(message, type = 'info') {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast-notification';
      document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.className = 'toast toast-' + type;
    toast.classList.add('visible');
    
    setTimeout(() => {
      toast.classList.remove('visible');
    }, 3000);
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
    } else if (format === 'report') {
      content = this.exportReport(notes);
      this.downloadFile(content, `复习报告_${this.formatDateForFilename()}.md`, 'text/markdown');
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

  exportReport(notes) {
    const now = new Date();
    const totalNotes = notes.length;
    const masteredNotes = notes.filter(n => n.mastered).length;
    const wrongNotes = notes.filter(n => n.isWrong).length;
    const unmasteredNotes = notes.filter(n => !n.mastered).length;
    const hotReviewNotes = notes.filter(n => (n.reviewCount || 0) >= 3).length;
    
    const now2 = Date.now();
    const overdueReminders = notes.filter(n => n.reviewReminder && n.reviewReminder < now2 && !n.mastered).length;
    const upcomingReminders = notes.filter(n => n.reviewReminder && n.reviewReminder >= now2 && !n.mastered).length;
    
    let md = '# 复习报告\n\n';
    md += `生成时间：${now.toLocaleString('zh-CN')}\n\n`;
    
    md += '## 总体概况\n\n';
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 总笔记数 | ${totalNotes} |\n`;
    md += `| 已掌握 | ${masteredNotes} (${totalNotes ? Math.round(masteredNotes / totalNotes * 100) : 0}%) |\n`;
    md += `| 未掌握 | ${unmasteredNotes} |\n`;
    md += `| 错题数 | ${wrongNotes} |\n`;
    md += `| 反复未掌握(复习≥3次) | ${hotReviewNotes} |\n`;
    md += `| 已过期提醒 | ${overdueReminders} |\n`;
    md += `| 待复习提醒 | ${upcomingReminders} |\n\n`;
    
    md += '## 掌握状态分布\n\n';
    md += '```\n';
    if (totalNotes > 0) {
      const masteredBar = '█'.repeat(Math.round(masteredNotes / totalNotes * 20));
      const unmasteredBar = '░'.repeat(20 - masteredBar.length);
      md += `已掌握 [${masteredBar}${unmasteredBar}] ${Math.round(masteredNotes / totalNotes * 100)}%\n`;
    }
    md += '```\n\n';
    
    const wrongNotesList = notes.filter(n => n.isWrong);
    if (wrongNotesList.length > 0) {
      md += '## ❌ 错题列表\n\n';
      wrongNotesList.forEach((note, i) => {
        md += `### ${i + 1}. ${note.text ? note.text.substring(0, 60) : '无内容'}\n\n`;
        if (note.comment) md += `备注：${note.comment}\n\n`;
        md += `- 掌握状态：${note.mastered ? '✅ 已掌握' : '❌ 未掌握'}\n`;
        md += `- 复习次数：${note.reviewCount || 0}\n`;
        if (note.lastReviewTime) md += `- 最近复习：${new Date(note.lastReviewTime).toLocaleString('zh-CN')}\n`;
        if (note.difficulty) {
          const diffText = { easy: '简单', medium: '中等', hard: '困难' }[note.difficulty];
          md += `- 难度：${diffText}\n`;
        }
        if (note.url) md += `- 来源：${note.url}\n`;
        md += '\n';
      });
    }
    
    const hotNotes = notes.filter(n => (n.reviewCount || 0) >= 3);
    if (hotNotes.length > 0) {
      md += '## 🔥 反复未掌握内容\n\n';
      md += '以下内容已复习 3 次以上仍未掌握，建议重点关注：\n\n';
      hotNotes.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
      hotNotes.forEach((note, i) => {
        md += `${i + 1}. **${note.text ? note.text.substring(0, 60) : '无内容'}** — 复习${note.reviewCount}次`;
        if (note.difficulty) {
          const diffText = { easy: '简单', medium: '中等', hard: '困难' }[note.difficulty];
          md += ` | 难度：${diffText}`;
        }
        md += '\n';
      });
      md += '\n';
    }
    
    const courses = this.groupNotesByCourse(notes);
    md += '## 按课程分组详情\n\n';
    courses.forEach(course => {
      const courseMastered = course.notes.filter(n => n.mastered).length;
      const courseTotal = course.notes.length;
      md += `### ${course.title}\n\n`;
      md += `掌握进度：${courseMastered}/${courseTotal}`;
      if (courseTotal > 0) md += ` (${Math.round(courseMastered / courseTotal * 100)}%)`;
      md += '\n\n';
      
      md += '| 内容 | 掌握 | 错题 | 复习次数 | 提醒时间 | 难度 |\n';
      md += '|------|------|------|----------|----------|------|\n';
      course.notes.forEach(note => {
        const text = (note.text || note.comment || '无内容').substring(0, 30).replace(/\|/g, '\\|').replace(/\n/g, ' ');
        const mastered = note.mastered ? '✅' : '❌';
        const wrong = note.isWrong ? '❌' : '-';
        const count = note.reviewCount || 0;
        const reminder = note.reviewReminder ? (note.reviewReminder < now2 ? '已过期' : new Date(note.reviewReminder).toLocaleDateString('zh-CN')) : '-';
        const diff = note.difficulty ? { easy: '简', medium: '中', hard: '难' }[note.difficulty] : '-';
        md += `| ${text} | ${mastered} | ${wrong} | ${count} | ${reminder} | ${diff} |\n`;
      });
      md += '\n';
    });
    
    return md;
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
