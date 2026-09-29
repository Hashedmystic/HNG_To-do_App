const tasksButton = document.querySelector('#show-tasks');
const notesButton = document.querySelector('#show-notes');
const tasksSection = document.querySelector('#tasks-section');
const notesSection = document.querySelector('#notes-section');

function showSection(showTasks) {
  // Hide sections without rebuilding them, so form drafts stay intact.
  tasksSection.hidden = !showTasks;
  notesSection.hidden = showTasks;
  tasksButton.setAttribute('aria-pressed', String(showTasks));
  notesButton.setAttribute('aria-pressed', String(!showTasks));
}

// Native buttons support Tab, Enter, and Space without extra key handlers.
tasksButton.addEventListener('click', function () {
  showSection(true);
});

notesButton.addEventListener('click', function () {
  showSection(false);
});

showSection(true);
