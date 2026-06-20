importScripts('utils/storage.js');

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'add-note',
    title: '添加到课程笔记',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'highlight-text',
    title: '高亮文字',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'open-sidepanel',
    title: '打开笔记侧边栏',
    contexts: ['page', 'selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'add-note' && info.selectionText) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    
    chrome.tabs.sendMessage(tab.id, {
      action: 'addNoteFromSelection',
      text: info.selectionText,
      pageTitle: tab.title,
      pageUrl: tab.url
    });
  }
  
  if (info.menuItemId === 'highlight-text' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'highlightSelection',
      text: info.selectionText
    });
  }
  
  if (info.menuItemId === 'open-sidepanel') {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'saveNote':
      handleSaveNote(message.note, sender, sendResponse);
      return true;
    case 'getNotesByUrl':
      handleGetNotesByUrl(message.url, sendResponse);
      return true;
    case 'getAllNotes':
      handleGetAllNotes(sendResponse);
      return true;
    case 'deleteNote':
      handleDeleteNote(message.noteId, sendResponse);
      return true;
    case 'getAllCourses':
      handleGetAllCourses(sendResponse);
      return true;
    case 'saveCourse':
      handleSaveCourse(message.course, sendResponse);
      return true;
    case 'findOrCreateCourse':
      handleFindOrCreateCourse(message.url, message.title, sendResponse);
      return true;
    case 'updateNoteMastery':
      handleUpdateNoteMastery(message.noteId, message.mastered, sendResponse);
      return true;
    case 'updateNoteWrong':
      handleUpdateNoteWrong(message.noteId, message.isWrong, sendResponse);
      return true;
    case 'setReviewReminder':
      handleSetReviewReminder(message.noteId, message.reminderTime, sendResponse);
      return true;
    case 'getAllTags':
      handleGetAllTags(sendResponse);
      return true;
    case 'getSettings':
      handleGetSettings(sendResponse);
      return true;
    case 'saveSettings':
      handleSaveSettings(message.settings, sendResponse);
      return true;
    default:
      break;
  }
});

async function handleSaveNote(noteData, sender, sendResponse) {
  try {
    if (!noteData.courseId && noteData.url) {
      const course = await Storage.findOrCreateCourseByUrl(noteData.url, noteData.pageTitle);
      noteData.courseId = course.id;
    }
    const note = await Storage.saveNote(noteData);
    sendResponse({ success: true, note });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetNotesByUrl(url, sendResponse) {
  try {
    const notes = await Storage.getNotesByUrl(url);
    sendResponse({ success: true, notes });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetAllNotes(sendResponse) {
  try {
    const notes = await Storage.getAllNotes();
    const courses = await Storage.getAllCourses();
    sendResponse({ success: true, notes, courses });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleDeleteNote(noteId, sendResponse) {
  try {
    await Storage.deleteNote(noteId);
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetAllCourses(sendResponse) {
  try {
    const courses = await Storage.getAllCourses();
    const notes = await Storage.getAllNotes();
    const coursesWithCount = courses.map(course => ({
      ...course,
      noteCount: notes.filter(n => n.courseId === course.id).length
    }));
    sendResponse({ success: true, courses: coursesWithCount });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleSaveCourse(course, sendResponse) {
  try {
    const savedCourse = await Storage.saveCourse(course);
    sendResponse({ success: true, course: savedCourse });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleFindOrCreateCourse(url, title, sendResponse) {
  try {
    const course = await Storage.findOrCreateCourseByUrl(url, title);
    sendResponse({ success: true, course });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleUpdateNoteMastery(noteId, mastered, sendResponse) {
  try {
    const note = await Storage.updateNoteMastery(noteId, mastered);
    sendResponse({ success: true, note });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleUpdateNoteWrong(noteId, isWrong, sendResponse) {
  try {
    const note = await Storage.updateNoteWrong(noteId, isWrong);
    sendResponse({ success: true, note });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleSetReviewReminder(noteId, reminderTime, sendResponse) {
  try {
    const note = await Storage.setReviewReminder(noteId, reminderTime);
    if (reminderTime) {
      chrome.alarms.create(`review_${noteId}`, { when: reminderTime });
    } else {
      chrome.alarms.clear(`review_${noteId}`);
    }
    sendResponse({ success: true, note });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetAllTags(sendResponse) {
  try {
    const tags = await Storage.getAllTags();
    sendResponse({ success: true, tags });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetSettings(sendResponse) {
  try {
    const settings = await Storage.getSettings();
    sendResponse({ success: true, settings });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleSaveSettings(settings, sendResponse) {
  try {
    await Storage.saveSettings(settings);
    sendResponse({ success: true, settings });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('review_')) {
    const noteId = alarm.name.replace('review_', '');
    const notes = await Storage.getAllNotes();
    const note = notes.find(n => n.id === noteId);
    if (note && note.reviewReminder && note.reviewReminder <= Date.now()) {
      chrome.notifications.create(`review_notif_${noteId}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '复习提醒',
        message: `该复习笔记了：${note.text ? note.text.substring(0, 50) + '...' : note.pageTitle}`
      });
    }
  }
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
