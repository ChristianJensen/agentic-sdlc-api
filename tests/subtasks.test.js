const request = require('supertest');
const app = require('../src/app');

const DUE_DATE = '2026-03-15T23:59:59Z';

async function createTask(title = 'Test Task', extra = {}) {
  const res = await request(app).post('/tasks').send({ title, dueDate: DUE_DATE, ...extra });
  return res.body;
}

beforeEach(() => {
  app._resetStore();
});

describe('GET /tasks/:id/subtasks', () => {
  it('returns empty array for task with no subtasks', async () => {
    await createTask();
    const res = await request(app).get('/tasks/1/subtasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 404 for nonexistent task', async () => {
    const res = await request(app).get('/tasks/999/subtasks');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns subtasks in creation order (oldest-first)', async () => {
    await createTask();
    await request(app).post('/tasks/1/subtasks').send({ title: 'First' });
    await request(app).post('/tasks/1/subtasks').send({ title: 'Second' });
    const res = await request(app).get('/tasks/1/subtasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe('First');
    expect(res.body[1].title).toBe('Second');
  });
});

describe('POST /tasks/:id/subtasks', () => {
  it('creates a subtask and returns 201 with all fields', async () => {
    await createTask();
    const res = await request(app).post('/tasks/1/subtasks').send({ title: 'My subtask' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.taskId).toBe(1);
    expect(res.body.title).toBe('My subtask');
    expect(res.body.completed).toBe(false);
    expect(res.body.createdAt).toBeDefined();
  });

  it('trims whitespace from title', async () => {
    await createTask();
    const res = await request(app).post('/tasks/1/subtasks').send({ title: '  trimmed  ' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('trimmed');
  });

  it('returns 404 for nonexistent task', async () => {
    const res = await request(app).post('/tasks/999/subtasks').send({ title: 'Subtask' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 for empty title', async () => {
    await createTask();
    const res = await request(app).post('/tasks/1/subtasks').send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 for whitespace-only title', async () => {
    await createTask();
    const res = await request(app).post('/tasks/1/subtasks').send({ title: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 for title over 200 characters', async () => {
    await createTask();
    const res = await request(app).post('/tasks/1/subtasks').send({ title: 'a'.repeat(201) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('accepts title exactly 200 characters', async () => {
    await createTask();
    const res = await request(app).post('/tasks/1/subtasks').send({ title: 'a'.repeat(200) });
    expect(res.status).toBe(201);
  });

  it('returns 400 when task is completed', async () => {
    await createTask();
    await request(app).patch('/tasks/1').send({ completed: true });
    const res = await request(app).post('/tasks/1/subtasks').send({ title: 'Subtask' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cannot add subtasks to a completed task');
  });

  it('returns 400 when task already has 20 subtasks', async () => {
    await createTask();
    for (let i = 0; i < 20; i++) {
      await request(app).post('/tasks/1/subtasks').send({ title: `Subtask ${i + 1}` });
    }
    const res = await request(app).post('/tasks/1/subtasks').send({ title: 'One too many' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Maximum 20 subtasks reached');
  });
});

describe('PATCH /tasks/:id/subtasks/:subtaskId', () => {
  it('toggles subtask completed to true', async () => {
    await createTask();
    await request(app).post('/tasks/1/subtasks').send({ title: 'Do it' });
    const res = await request(app).patch('/tasks/1/subtasks/1').send({ completed: true });
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
  });

  it('toggles subtask completed to false', async () => {
    await createTask();
    await request(app).post('/tasks/1/subtasks').send({ title: 'Do it' });
    await request(app).patch('/tasks/1/subtasks/1').send({ completed: true });
    const res = await request(app).patch('/tasks/1/subtasks/1').send({ completed: false });
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(false);
  });

  it('returns 404 for nonexistent task', async () => {
    const res = await request(app).patch('/tasks/999/subtasks/1').send({ completed: true });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for nonexistent subtask', async () => {
    await createTask();
    const res = await request(app).patch('/tasks/1/subtasks/999').send({ completed: true });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('auto-completes parent task when last incomplete subtask is completed', async () => {
    await createTask();
    await request(app).post('/tasks/1/subtasks').send({ title: 'Sub A' });
    await request(app).post('/tasks/1/subtasks').send({ title: 'Sub B' });
    await request(app).patch('/tasks/1/subtasks/1').send({ completed: true });
    // Parent should still be incomplete
    let parent = await request(app).get('/tasks/1');
    expect(parent.body.completed).toBe(false);
    // Complete the last subtask
    await request(app).patch('/tasks/1/subtasks/2').send({ completed: true });
    parent = await request(app).get('/tasks/1');
    expect(parent.body.completed).toBe(true);
  });

  it('re-opens parent task when a subtask is uncompleted', async () => {
    await createTask();
    await request(app).post('/tasks/1/subtasks').send({ title: 'Sub A' });
    await request(app).patch('/tasks/1/subtasks/1').send({ completed: true });
    // Parent should be auto-completed
    let parent = await request(app).get('/tasks/1');
    expect(parent.body.completed).toBe(true);
    // Uncomplete the subtask
    await request(app).patch('/tasks/1/subtasks/1').send({ completed: false });
    parent = await request(app).get('/tasks/1');
    expect(parent.body.completed).toBe(false);
  });
});

describe('DELETE /tasks/:id/subtasks/:subtaskId', () => {
  it('deletes a subtask and returns 204', async () => {
    await createTask();
    await request(app).post('/tasks/1/subtasks').send({ title: 'To delete' });
    const res = await request(app).delete('/tasks/1/subtasks/1');
    expect(res.status).toBe(204);
  });

  it('subtask no longer appears after deletion', async () => {
    await createTask();
    await request(app).post('/tasks/1/subtasks').send({ title: 'To delete' });
    await request(app).delete('/tasks/1/subtasks/1');
    const res = await request(app).get('/tasks/1/subtasks');
    expect(res.body).toHaveLength(0);
  });

  it('returns 404 for nonexistent task', async () => {
    const res = await request(app).delete('/tasks/999/subtasks/1');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for nonexistent subtask', async () => {
    await createTask();
    const res = await request(app).delete('/tasks/1/subtasks/999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('auto-completes parent if remaining subtasks are all complete after deletion', async () => {
    await createTask();
    await request(app).post('/tasks/1/subtasks').send({ title: 'Done' });
    await request(app).post('/tasks/1/subtasks').send({ title: 'Incomplete' });
    await request(app).patch('/tasks/1/subtasks/1').send({ completed: true });
    // Parent still incomplete (subtask 2 is not done)
    let parent = await request(app).get('/tasks/1');
    expect(parent.body.completed).toBe(false);
    // Delete the incomplete subtask — remaining (subtask 1) is complete
    await request(app).delete('/tasks/1/subtasks/2');
    parent = await request(app).get('/tasks/1');
    expect(parent.body.completed).toBe(true);
  });

  it('does not auto-complete parent if no subtasks remain after deletion', async () => {
    await createTask();
    await request(app).post('/tasks/1/subtasks').send({ title: 'Only one' });
    await request(app).delete('/tasks/1/subtasks/1');
    const parent = await request(app).get('/tasks/1');
    expect(parent.body.completed).toBe(false);
  });
});

describe('PATCH /tasks/:id blocks completed toggle when task has subtasks', () => {
  it('returns 400 when trying to set completed on task with subtasks', async () => {
    await createTask();
    await request(app).post('/tasks/1/subtasks').send({ title: 'A subtask' });
    const res = await request(app).patch('/tasks/1').send({ completed: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cannot manually toggle completed when task has subtasks');
  });

  it('allows setting completed on task with no subtasks', async () => {
    await createTask();
    const res = await request(app).patch('/tasks/1').send({ completed: true });
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
  });

  it('still allows updating title when task has subtasks', async () => {
    await createTask();
    await request(app).post('/tasks/1/subtasks').send({ title: 'A subtask' });
    const res = await request(app).patch('/tasks/1').send({ title: 'New title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New title');
  });
});

describe('subtaskCount and completedSubtaskCount on task responses', () => {
  it('GET /tasks returns subtaskCount=0 and completedSubtaskCount=0 for task with no subtasks', async () => {
    await createTask();
    const res = await request(app).get('/tasks');
    expect(res.body[0].subtaskCount).toBe(0);
    expect(res.body[0].completedSubtaskCount).toBe(0);
  });

  it('GET /tasks/:id returns correct subtaskCount and completedSubtaskCount', async () => {
    await createTask();
    await request(app).post('/tasks/1/subtasks').send({ title: 'Sub A' });
    await request(app).post('/tasks/1/subtasks').send({ title: 'Sub B' });
    await request(app).patch('/tasks/1/subtasks/1').send({ completed: true });
    const res = await request(app).get('/tasks/1');
    expect(res.body.subtaskCount).toBe(2);
    expect(res.body.completedSubtaskCount).toBe(1);
  });

  it('POST /tasks returns subtaskCount=0 and completedSubtaskCount=0 on newly created task', async () => {
    const res = await request(app).post('/tasks').send({ title: 'New', dueDate: DUE_DATE });
    expect(res.body.subtaskCount).toBe(0);
    expect(res.body.completedSubtaskCount).toBe(0);
  });
});

describe('Cascade delete subtasks when parent task is deleted', () => {
  it('deletes all subtasks when parent task is deleted', async () => {
    await createTask();
    await request(app).post('/tasks/1/subtasks').send({ title: 'Sub 1' });
    await request(app).post('/tasks/1/subtasks').send({ title: 'Sub 2' });
    await request(app).delete('/tasks/1');
    // Task gone — subtasks endpoint returns 404
    const res = await request(app).get('/tasks/1/subtasks');
    expect(res.status).toBe(404);
  });
});

describe('_resetStore clears subtask data', () => {
  it('subtasks are cleared after reset', async () => {
    await createTask();
    await request(app).post('/tasks/1/subtasks').send({ title: 'Lingering subtask' });
    app._resetStore();
    await createTask(); // id=1 again
    const res = await request(app).get('/tasks/1/subtasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});
