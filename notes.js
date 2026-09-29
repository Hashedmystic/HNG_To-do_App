const noteForm = document.querySelector('#note-form');
const noteTitle = document.querySelector('#note-title');
const noteBody = document.querySelector('#note-body');
const noteFormHeading = document.querySelector('#note-form-heading');
const noteSubmit = document.querySelector('#note-submit');
const noteCancel = document.querySelector('#note-cancel');
const noteList = document.querySelector('#note-list');
const notesEmpty = document.querySelector('#notes-empty');
const noteError = document.querySelector('#note-error');
const noteStatus = document.querySelector('#note-status');
const noteStorageStatus = document.querySelector('#note-storage-status');
const notesStorageKey = 'hng-todo-notes';
let notes = [];
let editingNote = null;
// Expansion is temporary UI state, never part of saved note data.
const expandedNotes = new WeakSet();

// Use the same rules for form values and data read from storage.
function validNoteText(value, maxLength) {
  return typeof value === 'string' &&
    value.trim().length > 0 && value.length <= maxLength;
}

function validCreationDate(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function saveNotes() {
  try {
    localStorage.setItem(notesStorageKey, JSON.stringify(notes));
    noteStorageStatus.textContent = '';
  } catch {
    noteStorageStatus.textContent = 'Notes could not be saved. You can keep working, but your latest changes may be lost after refresh.';
  }
}

function loadNotes() {
  let storedNotes;
  try {
    storedNotes = localStorage.getItem(notesStorageKey);
  } catch {
    noteStorageStatus.textContent = 'Saved notes could not be read. You can still use notes on this page.';
    return;
  }

  if (storedNotes === null) return;

  let parsedNotes;
  try {
    parsedNotes = JSON.parse(storedNotes);
  } catch {
    noteStorageStatus.textContent = 'Saved notes contain invalid data and could not be loaded.';
    return;
  }

  if (!Array.isArray(parsedNotes)) {
    noteStorageStatus.textContent = 'Saved notes contain invalid data and could not be loaded.';
    return;
  }

  for (const savedNote of parsedNotes) {
    if (savedNote === null || typeof savedNote !== 'object' ||
        Array.isArray(savedNote) || !validNoteText(savedNote.title, 200) ||
        !validNoteText(savedNote.body, 5000)) {
      noteStorageStatus.textContent = 'Some saved notes were invalid and were skipped.';
      continue;
    }
    // Copy only supported fields; preserve the body's spacing and line breaks.
    // Older notes have no recorded creation date; do not invent one.
    const createdAt = validCreationDate(savedNote.createdAt) ? savedNote.createdAt : null;
    notes.push({ title: savedNote.title.trim(), body: savedNote.body, createdAt: createdAt });
  }
  renderNotes();
}

function clearNoteErrors() {
  noteError.textContent = '';
  noteTitle.removeAttribute('aria-invalid');
  noteBody.removeAttribute('aria-invalid');
}

function resetNoteForm() {
  editingNote = null;
  noteForm.reset();
  noteFormHeading.textContent = 'Create a note';
  noteSubmit.textContent = 'Add note';
  noteCancel.hidden = true;
  clearNoteErrors();
}

function renderNotes() {
  noteList.replaceChildren();
  notesEmpty.hidden = notes.length > 0;
  let noteNumber = 0;

  for (const note of notes) {
    const item = document.createElement('li');
    item.className = 'note';
    const heading = document.createElement('h4');
    const titleButton = document.createElement('button');
    titleButton.type = 'button';
    titleButton.className = 'note-toggle';
    titleButton.textContent = note.title;

    const details = document.createElement('div');
    noteNumber += 1;
    details.id = `note-details-${noteNumber}`;
    details.hidden = !expandedNotes.has(note);
    titleButton.setAttribute('aria-controls', details.id);
    titleButton.setAttribute('aria-expanded', String(!details.hidden));
    titleButton.addEventListener('click', function () {
      details.hidden = !details.hidden;
      titleButton.setAttribute('aria-expanded', String(!details.hidden));
      if (details.hidden) {
        expandedNotes.delete(note);
      } else {
        expandedNotes.add(note);
      }
    });
    heading.append(titleButton);
    const creationDate = document.createElement('p');
    creationDate.className = 'hint';
    if (note.createdAt === null) {
      creationDate.textContent = 'Creation date unknown';
    } else {
      const time = document.createElement('time');
      time.dateTime = note.createdAt;
      time.textContent = new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium', timeStyle: 'short',
      }).format(new Date(note.createdAt));
      creationDate.append('Created: ', time);
    }
    const body = document.createElement('p');
    body.className = 'note-body';
    body.textContent = note.body;

    const actions = document.createElement('div');
    actions.className = 'note-actions';
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.setAttribute('aria-label', `Edit note: ${note.title}`);
    editButton.addEventListener('click', function () {
      // Keep a reference to this note, so duplicate titles are independent.
      editingNote = note;
      noteTitle.value = note.title;
      noteBody.value = note.body;
      noteFormHeading.textContent = 'Edit note';
      noteSubmit.textContent = 'Save changes';
      noteCancel.hidden = false;
      clearNoteErrors();
      noteStatus.textContent = 'Editing note. Save changes or cancel to keep the original.';
      noteTitle.focus();
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-button';
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', `Delete note: ${note.title}`);
    deleteButton.addEventListener('click', function () {
      notes = notes.filter(function (existingNote) {
        return existingNote !== note;
      });
      if (editingNote === note) resetNoteForm();
      renderNotes();
      saveNotes();
      noteStatus.textContent = 'Note deleted.';
      noteTitle.focus();
    });

    actions.append(editButton, deleteButton);
    details.append(creationDate, body, actions);
    item.append(heading, details);
    noteList.append(item);
  }
}

noteForm.addEventListener('submit', function (event) {
  event.preventDefault();
  clearNoteErrors();
  const titleIsValid = validNoteText(noteTitle.value, 200);
  const bodyIsValid = validNoteText(noteBody.value, 5000);
  if (!titleIsValid || !bodyIsValid) {
    noteError.textContent = 'Enter a title of 1–200 characters and a body of 1–5,000 characters. Neither can be only spaces.';
    if (!titleIsValid) noteTitle.setAttribute('aria-invalid', 'true');
    if (!bodyIsValid) noteBody.setAttribute('aria-invalid', 'true');
    (titleIsValid ? noteBody : noteTitle).focus();
    return;
  }

  const title = noteTitle.value.trim();
  const body = noteBody.value;
  if (editingNote !== null) {
    editingNote.title = title;
    editingNote.body = body;
    noteStatus.textContent = 'Note updated.';
  } else {
    notes.push({ title: title, body: body, createdAt: new Date().toISOString() });
    noteStatus.textContent = 'Note added.';
  }
  renderNotes();
  saveNotes();
  resetNoteForm();
  noteTitle.focus();
});

noteCancel.addEventListener('click', function () {
  resetNoteForm();
  noteStatus.textContent = 'Edit cancelled. The original note was kept.';
  noteTitle.focus();
});

noteTitle.addEventListener('input', clearNoteErrors);
noteBody.addEventListener('input', clearNoteErrors);
loadNotes();
