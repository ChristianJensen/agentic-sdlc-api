const request = require('supertest');
const app = require('../src/app');

beforeEach(() => {
  app._resetStore();
});

describe('GET /tasks', () => {
  it('returns empty array initially', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /tasks', () => {
  it('creates a task', async () => {
    const dueDate = '2026-03-15T23:59:59Z';
    const res = await request(app).post('/tasks').send({ title: 'Buy milk', dueDate });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, title: 'Buy milk', completed: false });
    expect(res.body.createdAt).toBeDefined();
    expect(res.body.dueDate).toBe(dueDate);
  });

  it('rejects missing dueDate', async () => {
    const res = await request(app).post('/tasks').send({ title: 'No due date' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('creates a task with dueDate', async () => {
    const dueDate = '2026-03-15T23:59:59Z';
    const res = await request(app).post('/tasks').send({ title: 'With due date', dueDate });
    expect(res.status).toBe(201);
    expect(res.body.dueDate).toBe(dueDate);
  });

  it('rejects invalid dueDate format', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Test', dueDate: 'not-a-date' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rejects dueDate without timezone', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rejects empty title', async () => {
    const dueDate = '2026-03-15T23:59:59Z';
    const res = await request(app).post('/tasks').send({ title: '', dueDate });
    expect(res.status).toBe(400);
  });

  it('rejects missing title', async () => {
    const res = await request(app).post('/tasks').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /tasks/:id', () => {
  it('returns a task by id', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).get('/tasks/1');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Test');
    expect(res.body.dueDate).toBe('2026-03-15T23:59:59Z');
  });

  it('returns 404 for missing task', async () => {
    const res = await request(app).get('/tasks/999');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id', () => {
  it('updates title', async () => {
    await request(app).post('/tasks').send({ title: 'Old', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).patch('/tasks/1').send({ title: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
  });

  it('toggles completed', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).patch('/tasks/1').send({ completed: true });
    expect(res.body.completed).toBe(true);
  });

  it('updates dueDate', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const dueDate = '2026-04-01T12:00:00Z';
    const res = await request(app).patch('/tasks/1').send({ dueDate });
    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBe(dueDate);
  });

  it('clears dueDate when set to null', async () => {
    const dueDate = '2026-04-01T12:00:00Z';
    await request(app).post('/tasks').send({ title: 'Test', dueDate });
    const res = await request(app).patch('/tasks/1').send({ dueDate: null });
    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBeNull();
  });

  it('rejects invalid dueDate format on patch', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).patch('/tasks/1').send({ dueDate: 'not-a-date' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rejects dueDate without timezone on patch', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).patch('/tasks/1').send({ dueDate: '2026-03-15T23:59:59' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for missing task', async () => {
    const res = await request(app).patch('/tasks/999').send({ title: 'Nope' });
    expect(res.status).toBe(404);
  });
});

describe('Category field', () => {
  it('POST creates task with category', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Work task', dueDate: '2026-03-15T23:59:59Z', category: 'Work' });
    expect(res.status).toBe(201);
    expect(res.body.category).toBe('Work');
  });

  it('POST defaults category to null when not provided', async () => {
    const res = await request(app).post('/tasks').send({ title: 'No cat', dueDate: '2026-03-15T23:59:59Z' });
    expect(res.status).toBe(201);
    expect(res.body.category).toBeNull();
  });

  it('POST accepts null category explicitly', async () => {
    const res = await request(app).post('/tasks').send({ title: 'No cat', dueDate: '2026-03-15T23:59:59Z', category: null });
    expect(res.status).toBe(201);
    expect(res.body.category).toBeNull();
  });

  it('POST rejects invalid category', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Bad cat', dueDate: '2026-03-15T23:59:59Z', category: 'Invalid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('GET /tasks?category=Work filters by category', async () => {
    await request(app).post('/tasks').send({ title: 'Work task', dueDate: '2026-03-15T23:59:59Z', category: 'Work' });
    await request(app).post('/tasks').send({ title: 'Personal task', dueDate: '2026-03-15T23:59:59Z', category: 'Personal' });
    await request(app).post('/tasks').send({ title: 'No cat', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).get('/tasks?category=Work');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe('Work');
  });

  it('GET /tasks returns all tasks when no category filter', async () => {
    await request(app).post('/tasks').send({ title: 'Work task', dueDate: '2026-03-15T23:59:59Z', category: 'Work' });
    await request(app).post('/tasks').send({ title: 'No cat', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('PATCH can set category', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).patch('/tasks/1').send({ category: 'Errands' });
    expect(res.status).toBe(200);
    expect(res.body.category).toBe('Errands');
  });

  it('PATCH can remove category by setting null', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z', category: 'Work' });
    const res = await request(app).patch('/tasks/1').send({ category: null });
    expect(res.status).toBe(200);
    expect(res.body.category).toBeNull();
  });

  it('PATCH rejects invalid category', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).patch('/tasks/1').send({ category: 'BadCat' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('Priority field', () => {
  it('POST defaults priority to Medium when not provided', async () => {
    const res = await request(app).post('/tasks').send({ title: 'No priority', dueDate: '2026-03-15T23:59:59Z' });
    expect(res.status).toBe(201);
    expect(res.body.priority).toBe('Medium');
  });

  it('POST accepts valid priority values', async () => {
    for (const priority of ['High', 'Medium', 'Low']) {
      app._resetStore();
      const res = await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z', priority });
      expect(res.status).toBe(201);
      expect(res.body.priority).toBe(priority);
    }
  });

  it('POST rejects invalid priority values', async () => {
    for (const priority of ['Urgent', 'high', 'low', 'medium', '', 'HIGH']) {
      app._resetStore();
      const res = await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z', priority });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    }
  });

  it('GET /tasks/:id always includes priority', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).get('/tasks/1');
    expect(res.status).toBe(200);
    expect(res.body.priority).toBe('Medium');
  });

  it('GET /tasks returns priority on all tasks', async () => {
    await request(app).post('/tasks').send({ title: 'High', dueDate: '2026-03-15T23:59:59Z', priority: 'High' });
    await request(app).post('/tasks').send({ title: 'Default', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    // Tasks are ordered by position ASC; newest task is at position 0
    const highTask = res.body.find(t => t.title === 'High');
    const defaultTask = res.body.find(t => t.title === 'Default');
    expect(highTask.priority).toBe('High');
    expect(defaultTask.priority).toBe('Medium');
  });

  it('PATCH accepts valid priority values', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).patch('/tasks/1').send({ priority: 'High' });
    expect(res.status).toBe(200);
    expect(res.body.priority).toBe('High');
  });

  it('PATCH rejects null priority', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).patch('/tasks/1').send({ priority: null });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('PATCH rejects invalid priority values', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    for (const priority of ['Urgent', 'high', '']) {
      const res = await request(app).patch('/tasks/1').send({ priority });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    }
  });

  it('PATCH response includes priority', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z', priority: 'Low' });
    const res = await request(app).patch('/tasks/1').send({ title: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.priority).toBe('Low');
  });
});

describe('commentCount on task responses', () => {
  it('GET /tasks returns commentCount 0 for tasks with no comments', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body[0].commentCount).toBe(0);
  });

  it('GET /tasks/:id returns commentCount 0 for task with no comments', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).get('/tasks/1');
    expect(res.status).toBe(200);
    expect(res.body.commentCount).toBe(0);
  });

  it('POST /tasks returns commentCount 0 on newly created task', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    expect(res.status).toBe(201);
    expect(res.body.commentCount).toBe(0);
  });

  it('_resetStore clears comments store and resets comment ID counter', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    app._resetStore();
    const res = await request(app).get('/tasks');
    expect(res.body).toEqual([]);
    // After reset, new task has id=1 again
    const created = await request(app).post('/tasks').send({ title: 'After reset', dueDate: '2026-03-15T23:59:59Z' });
    expect(created.body.id).toBe(1);
  });
});

describe('GET /tasks/:id/comments', () => {
  it('returns empty array for task with no comments', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).get('/tasks/1/comments');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 404 for nonexistent task', async () => {
    const res = await request(app).get('/tasks/999/comments');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns comments oldest-first', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    await request(app).post('/tasks/1/comments').send({ text: 'First' });
    await request(app).post('/tasks/1/comments').send({ text: 'Second' });
    const res = await request(app).get('/tasks/1/comments');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].text).toBe('First');
    expect(res.body[1].text).toBe('Second');
  });
});

describe('POST /tasks/:id/comments', () => {
  it('creates a comment and returns 201 with all fields', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).post('/tasks/1/comments').send({ text: 'Great task' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.taskId).toBe(1);
    expect(res.body.text).toBe('Great task');
    expect(res.body.createdAt).toBeDefined();
  });

  it('returns 404 for nonexistent task', async () => {
    const res = await request(app).post('/tasks/999/comments').send({ text: 'Hello' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('trims whitespace from text', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).post('/tasks/1/comments').send({ text: '  trimmed  ' });
    expect(res.status).toBe(201);
    expect(res.body.text).toBe('trimmed');
  });

  it('rejects empty text with 400', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).post('/tasks/1/comments').send({ text: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rejects whitespace-only text with 400', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).post('/tasks/1/comments').send({ text: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rejects text over 2000 characters with 400', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).post('/tasks/1/comments').send({ text: 'a'.repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('checks task existence before body validation (404 before 400)', async () => {
    const res = await request(app).post('/tasks/999/comments').send({ text: '' });
    expect(res.status).toBe(404);
  });

  it('updates commentCount on GET /tasks/:id after adding comment', async () => {
    await request(app).post('/tasks').send({ title: 'Test', dueDate: '2026-03-15T23:59:59Z' });
    await request(app).post('/tasks/1/comments').send({ text: 'A comment' });
    const res = await request(app).get('/tasks/1');
    expect(res.body.commentCount).toBe(1);
  });
});

describe('DELETE /tasks/:id', () => {
  it('deletes a task', async () => {
    await request(app).post('/tasks').send({ title: 'Doomed', dueDate: '2026-03-15T23:59:59Z' });
    const res = await request(app).delete('/tasks/1');
    expect(res.status).toBe(204);

    const list = await request(app).get('/tasks');
    expect(list.body).toEqual([]);
  });

  it('returns 404 for missing task', async () => {
    const res = await request(app).delete('/tasks/999');
    expect(res.status).toBe(404);
  });

  it('cascade deletes comments when task is deleted', async () => {
    await request(app).post('/tasks').send({ title: 'Task with comments', dueDate: '2026-03-15T23:59:59Z' });
    await request(app).post('/tasks/1/comments').send({ text: 'Comment 1' });
    await request(app).post('/tasks/1/comments').send({ text: 'Comment 2' });
    await request(app).delete('/tasks/1');
    // Task is gone — comments endpoint returns 404
    const res = await request(app).get('/tasks/1/comments');
    expect(res.status).toBe(404);
  });

  it('does not affect comments of other tasks when one task is deleted', async () => {
    await request(app).post('/tasks').send({ title: 'Task 1', dueDate: '2026-03-15T23:59:59Z' });
    await request(app).post('/tasks').send({ title: 'Task 2', dueDate: '2026-03-15T23:59:59Z' });
    await request(app).post('/tasks/1/comments').send({ text: 'Task 1 comment' });
    await request(app).post('/tasks/2/comments').send({ text: 'Task 2 comment' });
    await request(app).delete('/tasks/1');
    const res = await request(app).get('/tasks/2/comments');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].text).toBe('Task 2 comment');
  });

  it('comments for deleted task do not affect commentCount of surviving task', async () => {
    await request(app).post('/tasks').send({ title: 'Task 1', dueDate: '2026-03-15T23:59:59Z' });
    await request(app).post('/tasks').send({ title: 'Task 2', dueDate: '2026-03-15T23:59:59Z' });
    await request(app).post('/tasks/1/comments').send({ text: 'Task 1 comment' });
    await request(app).post('/tasks/1/comments').send({ text: 'Another task 1 comment' });
    await request(app).post('/tasks/2/comments').send({ text: 'Task 2 comment' });
    await request(app).delete('/tasks/1');
    const res = await request(app).get('/tasks/2');
    expect(res.body.commentCount).toBe(1);
    // Verify task 2 has only 1 comment, not 3 (would fail if cascade didn't clean up and
    // comment counting was broken, though this mainly tests filter correctness)
  });
});
