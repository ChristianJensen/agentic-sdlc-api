const express = require('express');
const cors = require('cors');

const ISO_DATETIME_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const VALID_CATEGORIES = ['Work', 'Personal', 'Errands'];
const VALID_PRIORITIES = ['High', 'Medium', 'Low'];

function isValidDueDate(value) {
  if (typeof value !== 'string') return false;
  return ISO_DATETIME_WITH_TZ.test(value) && !isNaN(new Date(value).getTime());
}

const app = express();
app.use(cors());
app.use(express.json());

// In-memory stores
const tasks = new Map();
let nextId = 1;
const comments = new Map();
let nextCommentId = 1;
const subtasks = new Map();
let nextSubtaskId = 1;

function taskWithCount(task) {
  const taskSubtasks = [...subtasks.values()].filter(s => s.taskId === task.id);
  const commentCount = [...comments.values()].filter(c => c.taskId === task.id).length;
  return {
    ...task,
    commentCount,
    subtaskCount: taskSubtasks.length,
    completedSubtaskCount: taskSubtasks.filter(s => s.completed).length,
  };
}

function applyAutoComplete(taskId) {
  const task = tasks.get(taskId);
  if (!task) return;
  const taskSubtasks = [...subtasks.values()].filter(s => s.taskId === taskId);
  if (taskSubtasks.length === 0) return;
  const allComplete = taskSubtasks.every(s => s.completed);
  task.completed = allComplete;
}

// GET /tasks
app.get('/tasks', (req, res) => {
  const { category } = req.query;
  if (category !== undefined) {
    return res.json([...tasks.values()].filter(t => t.category === category).map(taskWithCount));
  }
  res.json([...tasks.values()].map(taskWithCount));
});

// GET /tasks/:id
app.get('/tasks/:id', (req, res) => {
  const task = tasks.get(Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(taskWithCount(task));
});

// POST /tasks
app.post('/tasks', (req, res) => {
  const { title, dueDate, category, priority } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (!dueDate || !isValidDueDate(dueDate)) {
    return res.status(400).json({ error: 'dueDate is required and must be an ISO 8601 date-time with timezone (e.g. 2026-03-15T23:59:59Z)' });
  }
  if (category !== undefined && category !== null && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }
  if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
  }
  const task = {
    id: nextId++,
    title: title.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
    dueDate,
    category: category !== undefined ? category : null,
    priority: priority !== undefined ? priority : 'Medium',
  };
  tasks.set(task.id, task);
  res.status(201).json(taskWithCount(task));
});

// PATCH /tasks/:id
app.patch('/tasks/:id', (req, res) => {
  const task = tasks.get(Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const { title, completed, dueDate, category, priority } = req.body;
  if (title !== undefined) task.title = String(title).trim();
  if (completed !== undefined) {
    const hasSubtasks = [...subtasks.values()].some(s => s.taskId === task.id);
    if (hasSubtasks) {
      return res.status(400).json({ error: 'Cannot manually toggle completed when task has subtasks' });
    }
    task.completed = Boolean(completed);
  }
  if (dueDate !== undefined) {
    if (dueDate !== null && !isValidDueDate(dueDate)) {
      return res.status(400).json({ error: 'dueDate must be an ISO 8601 date-time with timezone (e.g. 2026-03-15T23:59:59Z)' });
    }
    task.dueDate = dueDate;
  }
  if (category !== undefined) {
    if (category !== null && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }
    task.category = category;
  }
  if (priority !== undefined) {
    if (!VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
    task.priority = priority;
  }
  res.json(taskWithCount(task));
});

// GET /tasks/:id/comments
app.get('/tasks/:id/comments', (req, res) => {
  const id = Number(req.params.id);
  if (!tasks.has(id)) return res.status(404).json({ error: 'Task not found' });
  const taskComments = [...comments.values()].filter(c => c.taskId === id);
  res.json(taskComments);
});

// POST /tasks/:id/comments
app.post('/tasks/:id/comments', (req, res) => {
  const id = Number(req.params.id);
  if (!tasks.has(id)) return res.status(404).json({ error: 'Task not found' });
  const { text } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required and cannot be empty' });
  }
  const trimmed = text.trim();
  if (trimmed.length > 2000) {
    return res.status(400).json({ error: 'text must be 2000 characters or fewer' });
  }
  const comment = {
    id: nextCommentId++,
    taskId: id,
    text: trimmed,
    createdAt: new Date().toISOString(),
  };
  comments.set(comment.id, comment);
  res.status(201).json(comment);
});

// GET /tasks/:id/subtasks
app.get('/tasks/:id/subtasks', (req, res) => {
  const id = Number(req.params.id);
  if (!tasks.has(id)) return res.status(404).json({ error: 'Task not found' });
  const taskSubtasks = [...subtasks.values()].filter(s => s.taskId === id);
  res.json(taskSubtasks);
});

// POST /tasks/:id/subtasks
app.post('/tasks/:id/subtasks', (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.completed) return res.status(400).json({ error: 'Cannot add subtasks to a completed task' });
  const { title } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required and cannot be empty' });
  }
  const trimmed = title.trim();
  if (trimmed.length > 200) {
    return res.status(400).json({ error: 'title must be 200 characters or fewer' });
  }
  const taskSubtasks = [...subtasks.values()].filter(s => s.taskId === id);
  if (taskSubtasks.length >= 20) {
    return res.status(400).json({ error: 'Maximum 20 subtasks reached' });
  }
  const subtask = {
    id: nextSubtaskId++,
    taskId: id,
    title: trimmed,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  subtasks.set(subtask.id, subtask);
  res.status(201).json(subtask);
});

// PATCH /tasks/:id/subtasks/:subtaskId
app.patch('/tasks/:id/subtasks/:subtaskId', (req, res) => {
  const taskId = Number(req.params.id);
  const subtaskId = Number(req.params.subtaskId);
  if (!tasks.has(taskId)) return res.status(404).json({ error: 'Task not found' });
  const subtask = subtasks.get(subtaskId);
  if (!subtask || subtask.taskId !== taskId) return res.status(404).json({ error: 'Subtask not found' });
  const { completed } = req.body;
  if (completed !== undefined) subtask.completed = Boolean(completed);
  applyAutoComplete(taskId);
  res.json(subtask);
});

// DELETE /tasks/:id/subtasks/:subtaskId
app.delete('/tasks/:id/subtasks/:subtaskId', (req, res) => {
  const taskId = Number(req.params.id);
  const subtaskId = Number(req.params.subtaskId);
  if (!tasks.has(taskId)) return res.status(404).json({ error: 'Task not found' });
  const subtask = subtasks.get(subtaskId);
  if (!subtask || subtask.taskId !== taskId) return res.status(404).json({ error: 'Subtask not found' });
  subtasks.delete(subtaskId);
  applyAutoComplete(taskId);
  res.status(204).end();
});

// DELETE /tasks/:id
app.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!tasks.has(id)) return res.status(404).json({ error: 'Task not found' });
  tasks.delete(id);
  for (const [commentId, comment] of comments) {
    if (comment.taskId === id) comments.delete(commentId);
  }
  for (const [subtaskId, subtask] of subtasks) {
    if (subtask.taskId === id) subtasks.delete(subtaskId);
  }
  res.status(204).end();
});

// Reset for testing
app._resetStore = () => {
  tasks.clear(); nextId = 1;
  comments.clear(); nextCommentId = 1;
  subtasks.clear(); nextSubtaskId = 1;
};

module.exports = app;
