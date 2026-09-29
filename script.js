const taskForm = document.querySelector('#task-form');
const taskInput = document.querySelector('#task-title');
const taskDue = document.querySelector('#task-due');
const taskList = document.querySelector('#task-list');
const emptyMessage = document.querySelector('#empty-message');
const taskError = document.querySelector('#task-error');
const taskStatus = document.querySelector('#task-status');
const storageStatus = document.querySelector('#storage-status');
const storageKey = 'hng-todo-tasks';
let tasks = [];

function validDueDate(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
      value.startsWith('0000')) return false;

  // Round-trip the calendar fields to reject impossible dates, such as Feb 30.
  // UTC is only used for this check and formatting, not to convert the time.
  const date = new Date(`${value}:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 16) === value;
}

function formatDueDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }).format(new Date(`${value}:00Z`));
}

function saveTasks() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(tasks));
    storageStatus.textContent = '';
  } catch {
    storageStatus.textContent = 'Tasks could not be saved. You can keep working, but your latest changes may be lost after refresh.';
  }
}

function loadTasks() {
  let storedTasks;

  try {
    storedTasks = localStorage.getItem(storageKey);
  } catch {
    storageStatus.textContent = 'Saved tasks could not be read. You can still use the list on this page.';
    return;
  }

  if (storedTasks === null) return;

  let parsedTasks;
  try {
    parsedTasks = JSON.parse(storedTasks);
  } catch {
    storageStatus.textContent = 'Saved tasks contain invalid data and could not be loaded.';
    return;
  }

  if (!Array.isArray(parsedTasks)) {
    storageStatus.textContent = 'Saved tasks contain invalid data and could not be loaded.';
    return;
  }

  for (const savedTask of parsedTasks) {
    // Check every record, then copy only the fields the app understands.
    if (
      savedTask === null ||
      typeof savedTask !== 'object' ||
      Array.isArray(savedTask) ||
      typeof savedTask.title !== 'string' ||
      savedTask.title.length > 200 ||
      savedTask.title.trim().length === 0 ||
      typeof savedTask.completed !== 'boolean'
    ) {
      storageStatus.textContent = 'Some saved tasks were invalid and were skipped.';
      continue;
    }

    // Older tasks have no dueAt field. Keep usable tasks even if a stored date is bad.
    let dueAt = null;
    if (savedTask.dueAt !== undefined && savedTask.dueAt !== null) {
      if (validDueDate(savedTask.dueAt)) {
        dueAt = savedTask.dueAt;
      } else {
        storageStatus.textContent = 'Some saved task data was invalid. Invalid tasks were skipped and invalid due dates were removed.';
      }
    }

    tasks.push({
      title: savedTask.title.trim(),
      completed: savedTask.completed,
      dueAt: dueAt,
    });
  }

  // Loading only reads storage; it does not overwrite the saved data.
  for (const task of tasks) {
    renderTask(task);
  }
}

function updateEmptyMessage() {
  emptyMessage.hidden = taskList.children.length > 0;
}

function renderTask(taskData) {
  const task = document.createElement('li');
  task.className = 'task';

  // Wrapping the checkbox and title in a label makes both clickable.
  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = taskData.completed;

  const titleText = document.createElement('span');
  // Keep user input as plain text, even when it looks like HTML.
  titleText.textContent = taskData.title;

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete-button';
  deleteButton.textContent = 'Delete';
  deleteButton.setAttribute('aria-label', `Delete task: ${taskData.title}`);

  checkbox.addEventListener('change', function () {
    taskData.completed = checkbox.checked;
    saveTasks();
    // CSS uses the checkbox's checked state to cross out the title.
    taskStatus.textContent = checkbox.checked
      ? 'Task marked complete.'
      : 'Task marked incomplete.';
  });

  deleteButton.addEventListener('click', function () {
    tasks = tasks.filter(function (existingTask) {
      return existingTask !== taskData;
    });
    task.remove();
    saveTasks();
    updateEmptyMessage();
    taskStatus.textContent = 'Task deleted.';
    taskInput.focus();
  });

  label.append(checkbox, titleText);
  task.append(label, deleteButton);
  if (taskData.dueAt !== null) {
    const dueTime = document.createElement('time');
    dueTime.className = 'task-due';
    dueTime.dateTime = taskData.dueAt;
    dueTime.textContent = `Due: ${formatDueDate(taskData.dueAt)} (local time)`;
    task.append(dueTime);
  }
  taskList.append(task);
  updateEmptyMessage();
}

taskInput.addEventListener('input', function () {
  taskError.textContent = '';
  taskInput.removeAttribute('aria-invalid');
});

taskDue.addEventListener('input', function () {
  taskError.textContent = '';
  taskDue.removeAttribute('aria-invalid');
});

taskForm.addEventListener('submit', function (event) {
  // Handle the form here instead of reloading the page.
  event.preventDefault();
  const title = taskInput.value.trim();

  if (title.length === 0 || title.length > 200) {
    taskError.textContent = 'Enter a task title between 1 and 200 characters.';
    taskInput.setAttribute('aria-invalid', 'true');
    taskInput.focus();
    return;
  }

  const dueAt = taskDue.value === '' ? null : taskDue.value;
  if (!taskDue.validity.valid || (dueAt !== null && !validDueDate(dueAt))) {
    taskError.textContent = 'Choose a valid date and time, or clear the due date field.';
    taskDue.setAttribute('aria-invalid', 'true');
    taskDue.focus();
    return;
  }

  const taskData = { title: title, completed: false, dueAt: dueAt };
  tasks.push(taskData);
  renderTask(taskData);
  saveTasks();
  taskError.textContent = '';
  taskInput.removeAttribute('aria-invalid');
  taskDue.removeAttribute('aria-invalid');
  taskStatus.textContent = 'Task added.';
  taskForm.reset();
  taskInput.focus();
});

loadTasks();
