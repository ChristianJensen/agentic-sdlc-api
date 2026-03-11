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
    const res = await request(app).post('/tasks').send({ title: 'Buy milk' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, title: 'Buy milk', completed: false });
    expect(res.body.createdAt).toBeDefined();
  });

  it('rejects empty title', async () => {
    const res = await request(app).post('/tasks').send({ title: '' });
    expect(res.status).toBe(400);
  });

  it('rejects missing title', async () => {
    const res = await request(app).post('/tasks').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /tasks/:id', () => {
  it('returns a task by id', async () => {
    await request(app).post('/tasks').send({ title: 'Test' });
    const res = await request(app).get('/tasks/1');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Test');
  });

  it('returns 404 for missing task', async () => {
    const res = await request(app).get('/tasks/999');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id', () => {
  it('updates title', async () => {
    await request(app).post('/tasks').send({ title: 'Old' });
    const res = await request(app).patch('/tasks/1').send({ title: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
  });

  it('toggles completed', async () => {
    await request(app).post('/tasks').send({ title: 'Test' });
    const res = await request(app).patch('/tasks/1').send({ completed: true });
    expect(res.body.completed).toBe(true);
  });

  it('returns 404 for missing task', async () => {
    const res = await request(app).patch('/tasks/999').send({ title: 'Nope' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /tasks/:id', () => {
  it('deletes a task', async () => {
    await request(app).post('/tasks').send({ title: 'Doomed' });
    const res = await request(app).delete('/tasks/1');
    expect(res.status).toBe(204);

    const list = await request(app).get('/tasks');
    expect(list.body).toEqual([]);
  });

  it('returns 404 for missing task', async () => {
    const res = await request(app).delete('/tasks/999');
    expect(res.status).toBe(404);
  });
});
