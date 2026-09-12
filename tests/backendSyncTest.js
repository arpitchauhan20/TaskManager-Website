// ==========================================
// Comprehensive Backend Sync & Task REST API Test Suite
// ==========================================
const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const authRoutes = require('../routes/authRoutes');
const taskRoutes = require('../routes/taskRoutes');
const calendarRoutes = require('../routes/calendarRoutes');

const TEST_PORT = 9095;
const BASE_URL = `http://localhost:${TEST_PORT}`;

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: {}
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
      options.headers['Cookie'] = `auth_token=${token}`;
    }

    if (body) {
      const data = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(responseBody);
        } catch {}

        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json || responseBody
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function runBackendSyncTests() {
  console.log('===============================================================');
  console.log('🧪 Starting Backend REST API & Task Sync Test Suite...');
  console.log('===============================================================\n');

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/', calendarRoutes);

  const server = app.listen(TEST_PORT);

  try {
    // -------------------------------------------------------------
    // Test 1: Register User A and User B
    // -------------------------------------------------------------
    console.log('--- Test 1: Register User A and User B ---');
    const userAEmail = `user_a_${Date.now()}@example.com`;
    const userBEmail = `user_b_${Date.now()}@example.com`;

    const regA = await makeRequest('POST', '/api/auth/register', {
      name: 'Alice Developer',
      email: userAEmail,
      password: 'StrongPassword123!'
    });
    assert(regA.status === 201 && regA.body.token, 'User A registered successfully with JWT');
    const tokenA = regA.body.token;

    const regB = await makeRequest('POST', '/api/auth/register', {
      name: 'Bob Designer',
      email: userBEmail,
      password: 'StrongPassword123!'
    });
    assert(regB.status === 201 && regB.body.token, 'User B registered successfully with JWT');
    const tokenB = regB.body.token;

    // -------------------------------------------------------------
    // Test 2: Update Profile for User A
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Update Profile (PUT /api/auth/profile) ---');
    const updateProfRes = await makeRequest('PUT', '/api/auth/profile', {
      name: 'Alice Senior Architect'
    }, tokenA);
    assert(updateProfRes.status === 200 && updateProfRes.body.user.name === 'Alice Senior Architect', 'User A profile updated');

    const meRes = await makeRequest('GET', '/api/auth/me', null, tokenA);
    assert(meRes.status === 200 && meRes.body.user.name === 'Alice Senior Architect', 'GET /api/auth/me returns updated name');

    // -------------------------------------------------------------
    // Test 3: Create Tasks for User A
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Create Tasks for User A (POST /api/tasks) ---');
    const task1Res = await makeRequest('POST', '/api/tasks', {
      title: 'Design high-throughput database pipeline',
      description: 'Implement streaming buffers with rate limiter',
      deadline: '2026-09-15T18:00',
      priority: 'high',
      category: 'engineering'
    }, tokenA);
    assert(task1Res.status === 201 && task1Res.body.task?.id, 'Task 1 created for User A');
    const taskId1 = task1Res.body.task.id;

    const task2Res = await makeRequest('POST', '/api/tasks', {
      title: 'Review team pull requests',
      description: 'Check security and code coverage',
      deadline: '2026-09-16T12:00',
      priority: 'medium',
      category: 'code'
    }, tokenA);
    assert(task2Res.status === 201 && task2Res.body.task?.id, 'Task 2 created for User A');

    // -------------------------------------------------------------
    // Test 4: List Tasks for User A and User B (Multi-Tenant Isolation)
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Verify Multi-Tenant Task Isolation ---');
    const listA = await makeRequest('GET', '/api/tasks', null, tokenA);
    assert(listA.status === 200 && listA.body.tasks.length === 2, 'User A sees exactly 2 tasks');

    const listB = await makeRequest('GET', '/api/tasks', null, tokenB);
    assert(listB.status === 200 && listB.body.tasks.length === 0, 'User B sees 0 tasks (Tenant Isolation verified)');

    // -------------------------------------------------------------
    // Test 5: Update Task (PUT /api/tasks/:id)
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Update Task (PUT /api/tasks/:id) ---');
    const updateTaskRes = await makeRequest('PUT', `/api/tasks/${taskId1}`, {
      completed: true,
      priority: 'low'
    }, tokenA);
    assert(updateTaskRes.status === 200 && updateTaskRes.body.task.completed === true, 'Task 1 marked as completed');

    // Verify User B cannot mutate User A's task
    const crossTenantUpdate = await makeRequest('PUT', `/api/tasks/${taskId1}`, {
      completed: false
    }, tokenB);
    assert(crossTenantUpdate.status === 404, 'User B cannot mutate User A task (returns 404)');

    // -------------------------------------------------------------
    // Test 6: Bulk Task Sync (POST /api/tasks/sync)
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Bulk Task Sync (POST /api/tasks/sync) ---');
    const syncRes = await makeRequest('POST', '/api/tasks/sync', {
      tasks: [
        {
          id: 'offline_task_99',
          title: 'Offline drafted feature specification',
          deadline: '2026-09-20T10:00',
          priority: 'high',
          completed: false
        }
      ]
    }, tokenA);
    assert(syncRes.status === 200 && syncRes.body.tasks.some(t => t.id === 'offline_task_99'), 'Bulk sync merged offline tasks');

    // -------------------------------------------------------------
    // Test 7: Delete Task (DELETE /api/tasks/:id)
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Delete Task (DELETE /api/tasks/:id) ---');
    const deleteRes = await makeRequest('DELETE', `/api/tasks/${taskId1}`, null, tokenA);
    assert(deleteRes.status === 200 && deleteRes.body.success === true, 'Task 1 deleted successfully');

    const listAfterDelete = await makeRequest('GET', '/api/tasks', null, tokenA);
    assert(!listAfterDelete.body.tasks.some(t => t.id === taskId1), 'Task 1 is no longer in task list');

    console.log('\n===============================================================');
    console.log('🎉 ALL BACKEND REST API & GOOGLE SHEETS STORAGE TESTS PASSED!');
    console.log('===============================================================\n');
  } catch (err) {
    console.error('💥 Test execution error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runBackendSyncTests();
