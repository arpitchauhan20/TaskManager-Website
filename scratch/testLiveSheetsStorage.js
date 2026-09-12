const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const userStorage = require('../services/storage/userStorage');
const taskStorage = require('../services/storage/taskStorage');

async function testLiveStorage() {
  console.log('Testing live Google Sheets user and task storage...');

  // 1. Create a user
  const testEmail = `user_${Date.now()}@taskflow.dev`;
  console.log(`Creating user: ${testEmail}`);
  const user = await userStorage.createUser({
    id: 'usr_test_' + Date.now(),
    name: 'Google Sheets Live Test',
    email: testEmail,
    password_hash: '$2a$12$e6n.XN.Z8q7W...'
  });
  console.log('✅ User created:', user);

  // 2. Fetch user back from Google Sheets
  const fetchedUser = await userStorage.findByEmail(testEmail);
  console.log('✅ User fetched back from storage:', fetchedUser);

  // 3. Create a task in Google Sheets
  console.log('Creating task in Google Sheets...');
  const task = await taskStorage.createTask(user.id, {
    title: 'Test Google Sheets Persistence',
    description: 'This row was created automatically via Google Sheets API SDK',
    deadline: '2026-09-15T18:00',
    priority: 'high',
    category: 'database'
  });
  console.log('✅ Task created in Google Sheets:', task);

  // 4. Fetch tasks back
  const tasks = await taskStorage.getTasksByUserId(user.id);
  console.log('✅ Tasks fetched for user:', tasks.length);

  console.log('\n🎉 ALL LIVE GOOGLE SHEETS OPERATIONS SUCCEEDED!');
}

testLiveStorage().catch(err => {
  console.error('❌ Error during live storage test:', err);
});
