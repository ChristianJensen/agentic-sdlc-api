const express = require('express');
const cors = require('cors');

const ISO_DATETIME_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const VALID_CATEGORIES = ['Work', 'Personal', 'Errands'];

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

function taskWithCount(task) {
  const count = [...comments.values()].filter(c => c.taskId === task.id).length;
  return { ...task, commentCount: count };
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
  const { title, dueDate, category } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (!dueDate || !isValidDueDate(dueDate)) {
    return res.status(400).json({ error: 'dueDate is required and must be an ISO 8601 date-time with timezone (e.g. 2026-03-15T23:59:59Z)' });
  }
  if (category !== undefined && category !== null && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }
  const task = {
    id: nextId++,
    title: title.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
    dueDate,
    category: category !== undefined ? category : null,
  };
  tasks.set(task.id, task);
  res.status(201).json(taskWithCount(task));
});

// PATCH /tasks/:id
app.patch('/tasks/:id', (req, res) => {
  const task = tasks.get(Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const { title, completed, dueDate, category } = req.body;
  if (title !== undefined) task.title = String(title).trim();
  if (completed !== undefined) task.completed = Boolean(completed);
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

// DELETE /tasks/:id
app.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!tasks.has(id)) return res.status(404).json({ error: 'Task not found' });
  tasks.delete(id);
  for (const [commentId, comment] of comments) {
    if (comment.taskId === id) comments.delete(commentId);
  }
  res.status(204).end();
});

// Reset for testing
app._resetStore = () => { tasks.clear(); nextId = 1; comments.clear(); nextCommentId = 1; };

module.exports = app;
