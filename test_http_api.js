import assert from "assert";

async function testHttp() {
  console.log("=== Testing Daybook HTTP Server APIs ===");
  const base = "http://127.0.0.1:3000";

  // Test 1: Demo login is removed (should 404)
  const demoRes = await fetch(`${base}/api/demo-login`, { method: "POST" });
  assert.strictEqual(demoRes.status, 404, "Demo login must be removed and return 404");
  console.log("✓ Demo login endpoint confirmed removed (404)");

  // Test 2: User signup
  const testUser = `user_${Date.now()}`;
  const pass = "secret123";
  const signupRes = await fetch(`${base}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: testUser, password: pass }),
  });
  assert.strictEqual(signupRes.status, 201, "Signup should return 201");
  const signupData = await signupRes.json();
  assert(signupData.token, "Signup must return token");
  console.log("✓ Signup successful with token");

  // Test 3: Login with credentials
  const loginRes = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: testUser, password: pass }),
  });
  assert.strictEqual(loginRes.status, 200, "Login should return 200");
  const loginData = await loginRes.json();
  const token = loginData.token;
  assert(token, "Login must return token");
  console.log("✓ Login successful");

  // Test 4: Auth headers & /api/me
  const meRes = await fetch(`${base}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(meRes.status, 200, "/api/me should return 200");
  const meData = await meRes.json();
  assert.strictEqual(meData.username, testUser, "Username should match");
  console.log("✓ /api/me authenticated successfully");

  // Test 5: Session initialization (theme and mentor)
  const sessionRes = await fetch(`${base}/api/session/start`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-client-date": "2026-09-16",
    },
    body: JSON.stringify({ theme: "onepiece", mentor: "zoro" }),
  });
  assert.strictEqual(sessionRes.status, 200, "Session start should return 200");
  const sessionData = await sessionRes.json();
  assert.strictEqual(sessionData.theme, "onepiece");
  assert.strictEqual(sessionData.mentor, "zoro");
  console.log("✓ Theme and mentor locked in session");

  // Test 6: Create activity
  const actRes = await fetch(`${base}/api/activities`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-client-date": "2026-09-16",
    },
    body: JSON.stringify({
      title: "Master Sword Technique",
      notes: "Practice 1000 swings",
      priority: true,
      date: "2026-09-16",
    }),
  });
  assert.strictEqual(actRes.status, 201, "Activity create should return 201");
  const actData = await actRes.json();
  assert(actData.id, "Activity should have an id");
  console.log("✓ Activity created:", actData.title);

  // Test 7: Get activities
  const getActsRes = await fetch(`${base}/api/activities`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(getActsRes.status, 200);
  const acts = await getActsRes.json();
  assert(acts.some((a) => a.id === actData.id), "Created activity should be returned");
  console.log("✓ Activities list retrieved:", acts.length);

  // Test 8: Toggle activity completion
  const toggleRes = await fetch(`${base}/api/activities/${actData.id}/toggle`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-client-date": "2026-09-16",
    },
  });
  assert.strictEqual(toggleRes.status, 200);
  const toggledData = await toggleRes.json();
  assert.strictEqual(toggledData.completed, true, "Activity should be completed");
  console.log("✓ Activity toggled to completed");

  // Test 9: Mentor message reflecting completion
  const mentorRes = await fetch(`${base}/api/mentor/message`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-client-date": "2026-09-16",
    },
  });
  assert.strictEqual(mentorRes.status, 200);
  const mentorData = await mentorRes.json();
  assert(mentorData.text, "Mentor text must be present");
  console.log("✓ Mentor advice received:", mentorData.text);

  // Test 10: Quests
  const questsRes = await fetch(`${base}/api/quests`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-client-date": "2026-09-16",
    },
  });
  assert.strictEqual(questsRes.status, 200);
  const questsData = await questsRes.json();
  assert(Array.isArray(questsData), "Quests should be an array");
  console.log("✓ Quests retrieved:", questsData.length);

  // Test 11: Delete activity
  const delRes = await fetch(`${base}/api/activities/${actData.id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-client-date": "2026-09-16",
    },
  });
  assert.strictEqual(delRes.status, 200);
  console.log("✓ Activity deleted");

  // Test 12: Logout
  const logoutRes = await fetch(`${base}/api/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(logoutRes.status, 200);
  console.log("✓ Logout successful");

  console.log("=== All HTTP API Tests Passed Flawlessly! ===");
}

testHttp()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("HTTP test error:", err);
    process.exit(1);
  });
