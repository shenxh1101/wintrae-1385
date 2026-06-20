const Storage = {
  KEYS: {
    NOTES: 'notes',
    COURSES: 'courses',
    TAGS: 'tags',
    SETTINGS: 'settings'
  },

  async get(key, defaultValue = null) {
    const result = await chrome.storage.local.get(key);
    return result[key] !== undefined ? result[key] : defaultValue;
  },

  async set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },

  async getAllNotes() {
    return await this.get(this.KEYS.NOTES, []);
  },

  async saveNote(note) {
    const notes = await this.getAllNotes();
    if (note.id) {
      const index = notes.findIndex(n => n.id === note.id);
      if (index !== -1) {
        notes[index] = { ...notes[index], ...note, updatedAt: Date.now() };
      } else {
        notes.push(note);
      }
    } else {
      note.id = 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      note.createdAt = Date.now();
      note.updatedAt = Date.now();
      note.mastered = false;
      note.isWrong = false;
      note.reviewReminder = null;
      note.reviewCount = 0;
      note.lastReviewTime = null;
      notes.push(note);
    }
    await this.set(this.KEYS.NOTES, notes);
    return note;
  },

  async deleteNote(noteId) {
    const notes = await this.getAllNotes();
    const filtered = notes.filter(n => n.id !== noteId);
    await this.set(this.KEYS.NOTES, filtered);
  },

  async getNotesByCourse(courseId) {
    const notes = await this.getAllNotes();
    return notes.filter(n => n.courseId === courseId);
  },

  async getNotesByUrl(url) {
    const notes = await this.getAllNotes();
    return notes.filter(n => n.url === url);
  },

  async getAllCourses() {
    return await this.get(this.KEYS.COURSES, []);
  },

  async saveCourse(course) {
    const courses = await this.getAllCourses();
    if (course.id) {
      const index = courses.findIndex(c => c.id === course.id);
      if (index !== -1) {
        courses[index] = { ...courses[index], ...course, updatedAt: Date.now() };
      } else {
        courses.push(course);
      }
    } else {
      course.id = 'course_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      course.createdAt = Date.now();
      course.updatedAt = Date.now();
      courses.push(course);
    }
    await this.set(this.KEYS.COURSES, courses);
    return course;
  },

  async deleteCourse(courseId) {
    const courses = await this.getAllCourses();
    const filtered = courses.filter(c => c.id !== courseId);
    await this.set(this.KEYS.COURSES, filtered);
    const notes = await this.getAllNotes();
    const filteredNotes = notes.filter(n => n.courseId !== courseId);
    await this.set(this.KEYS.NOTES, filteredNotes);
  },

  async findOrCreateCourseByUrl(url, title) {
    const courses = await this.getAllCourses();
    let course = courses.find(c => {
      try {
        const courseUrl = new URL(c.url);
        const noteUrl = new URL(url);
        return courseUrl.hostname === noteUrl.hostname && 
               courseUrl.pathname.split('/').slice(0, 3).join('/') === 
               noteUrl.pathname.split('/').slice(0, 3).join('/');
      } catch {
        return false;
      }
    });
    
    if (!course) {
      course = await this.saveCourse({
        title: title || document.title,
        url: url
      });
    }
    return course;
  },

  async getSettings() {
    return await this.get(this.KEYS.SETTINGS, {
      highlightColor: '#ffff00',
      defaultTags: [],
      exportFormat: 'markdown'
    });
  },

  async saveSettings(settings) {
    await this.set(this.KEYS.SETTINGS, settings);
  },

  async getAllTags() {
    const notes = await this.getAllNotes();
    const tagSet = new Set();
    notes.forEach(note => {
      if (note.tags) {
        note.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet);
  },

  async getReviewNotes(filter = {}) {
    let notes = await this.getAllNotes();
    
    if (filter.courseId) {
      notes = notes.filter(n => n.courseId === filter.courseId);
    }
    if (filter.tag) {
      notes = notes.filter(n => n.tags && n.tags.includes(filter.tag));
    }
    if (filter.mastered !== undefined) {
      notes = notes.filter(n => n.mastered === filter.mastered);
    }
    if (filter.isWrong !== undefined) {
      notes = notes.filter(n => n.isWrong === filter.isWrong);
    }
    if (filter.startDate) {
      notes = notes.filter(n => n.createdAt >= filter.startDate);
    }
    if (filter.endDate) {
      notes = notes.filter(n => n.createdAt <= filter.endDate);
    }
    
    notes.sort((a, b) => {
      if (filter.sortBy === 'createdAt') {
        return filter.sortOrder === 'asc' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
      }
      return b.createdAt - a.createdAt;
    });
    
    return notes;
  },

  async updateNoteMastery(noteId, mastered) {
    const notes = await this.getAllNotes();
    const note = notes.find(n => n.id === noteId);
    if (note) {
      note.mastered = mastered;
      note.updatedAt = Date.now();
      if (mastered) {
        note.reviewCount = (note.reviewCount || 0) + 1;
        note.lastReviewTime = Date.now();
      }
      await this.set(this.KEYS.NOTES, notes);
    }
    return note;
  },

  async updateNoteWrong(noteId, isWrong) {
    const notes = await this.getAllNotes();
    const note = notes.find(n => n.id === noteId);
    if (note) {
      note.isWrong = isWrong;
      note.updatedAt = Date.now();
      await this.set(this.KEYS.NOTES, notes);
    }
    return note;
  },

  async setReviewReminder(noteId, reminderTime) {
    const notes = await this.getAllNotes();
    const note = notes.find(n => n.id === noteId);
    if (note) {
      note.reviewReminder = reminderTime;
      note.updatedAt = Date.now();
      await this.set(this.KEYS.NOTES, notes);
    }
    return note;
  }
};
