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

describe('Position field on tasks', () => {
  it('POST /tasks returns position field on new task', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Task A', dueDate: DUE_DATE });
    expect(res.status).toBe(201);
    expect(res.body.position).toBe(0);
  });

  it('POST /tasks assigns position 0 to new task and shifts existing tasks down', async () => {
    await createTask('Task A');
    await createTask('Task B');
    const res = await request(app).post('/tasks').send({ title: 'Task C', dueDate: DUE_DATE });
    expect(res.status).toBe(201);
    expect(res.body.position).toBe(0);

    const list = await request(app).get('/tasks');
    const positions = list.body.map(t => ({ title: t.title, position: t.position }));
    expect(positions).toEqual([
      { title: 'Task C', position: 0 },
      { title: 'Task B', position: 1 },
      { title: 'Task A', position: 2 },
    ]);
  });

  it('GET /tasks returns tasks ordered by position ASC', async () => {
    await createTask('First');
    await createTask('Second');
    await createTask('Third');

    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body.map(t => t.title)).toEqual(['Third', 'Second', 'First']);
    expect(res.body.map(t => t.position)).toEqual([0, 1, 2]);
  });

  it('GET /tasks/:id returns position field', async () => {
    await createTask('Task');
    const res = await request(app).get('/tasks/1');
    expect(res.status).toBe(200);
    expect(res.body.position).toBeDefined();
    expect(typeof res.body.position).toBe('number');
  });
});

describe('PATCH /tasks/:id with position', () => {
  it('moves a task to a new position and rebalances others', async () => {
    await createTask('A'); // ends at position 2 after 3 inserts
    await createTask('B'); // ends at position 1
    await createTask('C'); // ends at position 0

    // State: C=0, B=1, A=2
    // Move A (id=1, position=2) to position 0
    const res = await request(app).patch('/tasks/1').send({ position: 0 });
    expect(res.status).toBe(200);
    expect(res.body.position).toBe(0);

    const list = await request(app).get('/tasks');
    expect(list.body.map(t => t.title)).toEqual(['A', 'C', 'B']);
    expect(list.body.map(t => t.position)).toEqual([0, 1, 2]);
  });

  it('moves a task from position 0 to end', async () => {
    await createTask('A'); // position 2
    await createTask('B'); // position 1
    await createTask('C'); // position 0

    // State: C=0, B=1, A=2
    // Move C (id=3, position=0) to position 2
    const res = await request(app).patch('/tasks/3').send({ position: 2 });
    expect(res.status).toBe(200);
    expect(res.body.position).toBe(2);

    const list = await request(app).get('/tasks');
    expect(list.body.map(t => t.title)).toEqual(['B', 'A', 'C']);
    expect(list.body.map(t => t.position)).toEqual([0, 1, 2]);
  });

  it('clamps position above count-1 to count-1', async () => {
    await createTask('A');
    await createTask('B');
    // State: B=0, A=1
    // PATCH with position=100 should clamp to 1
    const res = await request(app).patch('/tasks/2').send({ position: 100 });
    expect(res.status).toBe(200);
    expect(res.body.position).toBe(1);
  });

  it('clamps negative position to 0', async () => {
    await createTask('A');
    await createTask('B');
    // State: B=0, A=1
    const res = await request(app).patch('/tasks/1').send({ position: -5 });
    expect(res.status).toBe(200);
    expect(res.body.position).toBe(0);
  });

  it('does not change position when completing a task', async () => {
    await createTask('A'); // position 1
    await createTask('B'); // position 0
    // Complete task A (id=1, position=1)
    const res = await request(app).patch('/tasks/1').send({ completed: true });
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
    expect(res.body.position).toBe(1);

    const list = await request(app).get('/tasks');
    expect(list.body.map(t => t.title)).toEqual(['B', 'A']);
    expect(list.body.map(t => t.position)).toEqual([0, 1]);
  });

  it('moving task to same position is a no-op', async () => {
    await createTask('A'); // position 1
    await createTask('B'); // position 0
    const res = await request(app).patch('/tasks/2').send({ position: 0 });
    expect(res.status).toBe(200);
    expect(res.body.position).toBe(0);

    const list = await request(app).get('/tasks');
    expect(list.body.map(t => t.title)).toEqual(['B', 'A']);
  });
});

describe('DELETE /tasks/:id compacts positions', () => {
  it('compacts positions after deletion so they remain 0..N-1', async () => {
    await createTask('A'); // position 2
    await createTask('B'); // position 1
    await createTask('C'); // position 0
    // State: C=0, B=1, A=2
    // Delete B (id=2, position=1)
    const del = await request(app).delete('/tasks/2');
    expect(del.status).toBe(204);

    const list = await request(app).get('/tasks');
    expect(list.body).toHaveLength(2);
    expect(list.body.map(t => t.title)).toEqual(['C', 'A']);
    expect(list.body.map(t => t.position)).toEqual([0, 1]);
  });

  it('deleting first task compacts remaining correctly', async () => {
    await createTask('A'); // position 1
    await createTask('B'); // position 0
    // Delete B (id=2, position=0)
    await request(app).delete('/tasks/2');

    const list = await request(app).get('/tasks');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].title).toBe('A');
    expect(list.body[0].position).toBe(0);
  });
});

describe('GET /tasks with category filter preserves position order', () => {
  it('category filter returns tasks in position order', async () => {
    await createTask('Work 1', { category: 'Work' }); // position 2
    await createTask('Personal 1', { category: 'Personal' }); // position 1
    await createTask('Work 2', { category: 'Work' }); // position 0

    const res = await request(app).get('/tasks?category=Work');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map(t => t.title)).toEqual(['Work 2', 'Work 1']);
    expect(res.body.map(t => t.position)).toEqual([0, 2]);
  });
});
