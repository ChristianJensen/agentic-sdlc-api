const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory task store
const tasks = new Map();
let nextId = 1;

// GET /tasks
app.get('/tasks', (req, res) => {
  res.json([...tasks.values()]);
});

// GET /tasks/:id
app.get('/tasks/:id', (req, res) => {
  const task = tasks.get(Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// POST /tasks
app.post('/tasks', (req, res) => {
  const { title, dueDate } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const task = {
    id: nextId++,
    title: title.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
    dueDate: dueDate !== undefined ? dueDate : null,
  };
  tasks.set(task.id, task);
  res.status(201).json(task);
});

// PATCH /tasks/:id
app.patch('/tasks/:id', (req, res) => {
  const task = tasks.get(Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const { title, completed, dueDate } = req.body;
  if (title !== undefined) task.title = String(title).trim();
  if (completed !== undefined) task.completed = Boolean(completed);
  if (dueDate !== undefined) task.dueDate = dueDate;
  res.json(task);
});

// DELETE /tasks/:id
app.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!tasks.has(id)) return res.status(404).json({ error: 'Task not found' });
  tasks.delete(id);
  res.status(204).end();
});

// Reset for testing
app._resetStore = () => { tasks.clear(); nextId = 1; };

module.exports = app;
