const taskForm = document.querySelector('#task-form');
const taskInput = document.querySelector('#task-title');
const taskDue = document.querySelector('#task-due');
const taskReminder = document.querySelector('#task-reminder');
const customReminder = document.querySelector('#custom-reminder');
const reminderAmount = document.querySelector('#reminder-amount');
const reminderUnit = document.querySelector('#reminder-unit');
const reminderSection = document.querySelector('#reminders');
const reminderList = document.querySelector('#reminder-list');
const reminderStatus = document.querySelector('#reminder-status');
const taskList = document.querySelector('#task-list');
const emptyMessage = document.querySelector('#empty-message');
const taskError = document.querySelector('#task-error');
const taskStatus = document.querySelector('#task-status');
const storageStatus = document.querySelector('#storage-status');
const storageKey = 'hng-todo-tasks';
let tasks = [];

function validTaskTitle(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
}

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
    return true;
  } catch {
    storageStatus.textContent = 'Tasks could not be saved. You can keep working, but your latest changes may be lost after refresh.';
    return false;
  }
}

function validReminderMinutes(value) {
  return typeof value === 'number' && Number.isFinite(value) &&
    (value === 0 || (value >= 1 && value <= 4320));
}

function validReminderUnit(unit) {
  return ['minutes', 'hours', 'days'].includes(unit);
}

function minutesPerUnit(unit) {
  if (unit === 'days') return 1440;
  if (unit === 'hours') return 60;
  return 1;
}

function customReminderMinutes(amount, unit) {
  if (!validReminderUnit(unit) || typeof amount !== 'number' ||
      !Number.isFinite(amount) || amount <= 0) return null;
  const minutes = amount * minutesPerUnit(unit);
  return validReminderMinutes(minutes) && minutes >= 1 ? minutes : null;
}

function updateCustomReminder() {
  const isCustom = taskReminder.value === 'custom';
  customReminder.hidden = !isCustom;
  // Hidden fields must not block submission of a quick choice.
  reminderAmount.disabled = !isCustom;
  reminderUnit.disabled = !isCustom;
  reminderAmount.required = isCustom;
  reminderAmount.removeAttribute('aria-invalid');
  reminderUnit.removeAttribute('aria-invalid');
}

function formatReminder(task) {
  if (task.reminderMinutes === 0) return 'Reminder: at the due time';
  const unit = task.reminderUnit || (task.reminderMinutes === 60 ? 'hours' : 'minutes');
  const amount = task.reminderMinutes / minutesPerUnit(unit);
  const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 10 }).format(amount);
  const label = amount === 1 ? unit.slice(0, -1) : unit;
  const prefix = task.reminderUnit === null ? 'Reminder' : 'Custom reminder';
  return `${prefix}: ${number} ${label} before`;
}

function reminderTime(task) {
  // Due dates are local wall-clock times; subtract the selected number of minutes.
  return new Date(task.dueAt).getTime() - task.reminderMinutes * 60 * 1000;
}

function checkReminders(now = Date.now()) {
  for (const task of tasks) {
    if (task.completed || task.dueAt === null || task.reminderMinutes === null ||
        task.reminderShown || !(reminderTime(task) <= now)) continue;

    // Persist before displaying so a refresh cannot show this reminder again.
    task.reminderShown = true;
    if (!saveTasks()) {
      task.reminderShown = false;
      reminderStatus.textContent = 'Reminders are waiting because browser storage is unavailable. They will be retried when saving works.';
      return;
    }
    reminderStatus.textContent = '';
    const item = document.createElement('li');
    const message = document.createElement('p');
    message.textContent = `${task.title} — due ${formatDueDate(task.dueAt)} (local time)`;
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = 'Dismiss';
    dismiss.setAttribute('aria-label', `Dismiss reminder: ${task.title}`);
    dismiss.addEventListener('click', function () {
      item.remove();
      reminderSection.hidden = reminderList.children.length === 0;
      document.querySelector('#show-tasks').focus();
    });
    item.append(message, dismiss);
    reminderSection.hidden = false;
    reminderList.append(item);
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
      !validTaskTitle(savedTask.title) ||
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

    let reminderMinutes = null;
    let reminderShown = false;
    let savedReminderUnit = null;
    if (savedTask.reminderMinutes !== undefined && savedTask.reminderMinutes !== null) {
      const unit = savedTask.reminderUnit ?? null;
      if (dueAt !== null && validReminderMinutes(savedTask.reminderMinutes) &&
          typeof savedTask.reminderShown === 'boolean' &&
          (unit === null || (validReminderUnit(unit) && savedTask.reminderMinutes >= 1))) {
        reminderMinutes = savedTask.reminderMinutes;
        reminderShown = savedTask.reminderShown;
        savedReminderUnit = unit;
      } else {
        storageStatus.textContent = 'Some saved reminders were invalid and were disabled. The tasks are still available.';
      }
    }

    tasks.push({
      title: savedTask.title.trim(),
      completed: savedTask.completed,
      dueAt: dueAt,
      reminderMinutes: reminderMinutes,
      reminderShown: reminderShown,
      reminderUnit: savedReminderUnit,
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
    if (taskData.reminderMinutes !== null) {
      const reminderText = document.createElement('span');
      reminderText.className = 'task-due';
      reminderText.textContent = formatReminder(taskData);
      task.append(reminderText);
    }
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

taskReminder.addEventListener('change', function () {
  taskError.textContent = '';
  taskReminder.removeAttribute('aria-invalid');
  updateCustomReminder();
});

reminderAmount.addEventListener('input', function () {
  taskError.textContent = '';
  reminderAmount.removeAttribute('aria-invalid');
});

reminderUnit.addEventListener('change', function () {
  taskError.textContent = '';
  reminderAmount.removeAttribute('aria-invalid');
  reminderUnit.removeAttribute('aria-invalid');
});

taskForm.addEventListener('submit', function (event) {
  // Handle the form here instead of reloading the page.
  event.preventDefault();
  const title = taskInput.value.trim();

  if (!validTaskTitle(title)) {
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

  const reminderChoice = taskReminder.value;
  if (!['none', '0', '10', '60', 'custom'].includes(reminderChoice) ||
      (reminderChoice !== 'none' && dueAt === null)) {
    taskError.textContent = 'Choose a valid reminder and a due date and time, or select No reminder.';
    taskReminder.setAttribute('aria-invalid', 'true');
    taskReminder.focus();
    return;
  }

  let reminderMinutes = reminderChoice === 'none' ? null : Number(reminderChoice);
  let customUnit = null;
  if (reminderChoice === 'custom') {
    reminderMinutes = customReminderMinutes(reminderAmount.valueAsNumber, reminderUnit.value);
    if (reminderMinutes === null) {
      taskError.textContent = 'Enter a positive custom reminder totaling 1 minute to 3 days, using minutes, hours, or days.';
      reminderAmount.setAttribute('aria-invalid', 'true');
      reminderAmount.focus();
      return;
    }
    customUnit = reminderUnit.value;
  }

  const taskData = {
    title: title, completed: false, dueAt: dueAt,
    reminderMinutes: reminderMinutes,
    reminderUnit: customUnit,
    reminderShown: false,
  };
  tasks.push(taskData);
  renderTask(taskData);
  saveTasks();
  taskError.textContent = '';
  taskInput.removeAttribute('aria-invalid');
  taskDue.removeAttribute('aria-invalid');
  taskReminder.removeAttribute('aria-invalid');
  taskStatus.textContent = 'Task added.';
  taskForm.reset();
  updateCustomReminder();
  taskInput.focus();
  checkReminders();
});

loadTasks();
updateCustomReminder();
checkReminders();
setInterval(checkReminders, 1000);
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) checkReminders();
});
