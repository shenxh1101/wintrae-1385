const PopupApp = {
  state: {
    notes: [],
    courses: []
  },

  init() {
    this.loadData();
    this.setupEventListeners();
  },

  setupEventListeners() {
    document.getElementById('btn-open-sidepanel').addEventListener('click', () => {
      this.openSidePanel();
    });

    document.getElementById('link-review').addEventListener('click', () => {
      this.openSidePanelWithTab('review');
    });

    document.getElementById('link-courses').addEventListener('click', () => {
      this.openSidePanelWithTab('courses');
    });

    document.getElementById('link-export').addEventListener('click', () => {
      this.openSidePanelWithTab('export');
    });
  },

  async loadData() {
    chrome.runtime.sendMessage({ action: 'getAllNotes' }, (response) => {
      if (response && response.success) {
        this.state.notes = response.notes;
        this.state.courses = response.courses;
        this.renderStats();
        this.renderRecentNotes();
      }
    });
  },

  renderStats() {
    const totalNotes = this.state.notes.length;
    const totalCourses = this.state.courses.length;
    const reviewCount = this.state.notes.filter(n => !n.mastered).length;

    document.getElementById('stat-total').textContent = totalNotes;
    document.getElementById('stat-courses').textContent = totalCourses;
    document.getElementById('stat-review').textContent = reviewCount;
  },

  renderRecentNotes() {
    const listEl = document.getElementById('recent-list');
    const recentNotes = [...this.state.notes]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    if (recentNotes.length === 0) {
      listEl.innerHTML = '<div class="empty-text">暂无笔记</div>';
      return;
    }

    listEl.innerHTML = recentNotes.map(note => {
      const course = this.state.courses.find(c => c.id === note.courseId);
      const text = note.text || note.comment || '无内容';
      const timeAgo = this.formatTimeAgo(note.createdAt);
      
      return `
        <div class="recent-item" data-note-id="${note.id}">
          <div class="recent-text">${this.escapeHtml(text)}</div>
          <div class="recent-meta">
            <span>${this.escapeHtml(course ? course.title : '未分类')}</span>
            <span>${timeAgo}</span>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', () => {
        const noteId = item.dataset.noteId;
        this.openNote(noteId);
      });
    });
  },

  openSidePanel() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.sidePanel.open({ windowId: tabs[0].windowId });
      }
    });
    window.close();
  },

  openSidePanelWithTab(tabName) {
    chrome.storage.local.set({ openTab: tabName }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.sidePanel.open({ windowId: tabs[0].windowId });
        }
      });
    });
    window.close();
  },

  openNote(noteId) {
    const note = this.state.notes.find(n => n.id === noteId);
    if (note && note.url) {
      chrome.tabs.create({ url: note.url });
    }
  },

  formatTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    return new Date(timestamp).toLocaleDateString('zh-CN');
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  PopupApp.init();
});
