import assert from "assert";
import { db } from "./db.js";

async function runTests() {
  console.log("=== Starting Database Adapter Tests ===");
  console.log("Current backend mode:", db.getBackendType());

  // 1. User tests
  const testUsername = `testuser_${Date.now()}`;
  const user = await db.createUser({
    username: testUsername,
    password: "secretpassword123",
  });
  assert(user && user.id, "User creation failed");
  assert.strictEqual(user.username, testUsername, "Username mismatch");

  const fetchedUser = await db.findUserByUsername(testUsername);
  assert(fetchedUser && fetchedUser.id === user.id, "findUserByUsername failed");

  const byId = await db.findUserById(user.id);
  assert(byId && byId.username === testUsername, "findUserById failed");

  // 2. Session tests
  const testToken = `test_token_${Date.now()}`;
  const session = await db.createSession({
    token: testToken,
    userId: user.id,
    theme: "onepiece",
    mentor: "zoro",
  });
  assert(session && session.token === testToken, "Session creation failed");

  const fetchedSession = await db.findSession(testToken);
  assert(fetchedSession && fetchedSession.userId === user.id, "findSession failed");

  await db.updateSession(testToken, { theme: "naruto", mentor: "kakashi" });
  const updatedSession = await db.findSession(testToken);
  assert.strictEqual(updatedSession.mentor, "kakashi", "updateSession failed");

  // 3. Activity tests
  const act1 = await db.createActivity({
    userId: user.id,
    title: "Morning Routine",
    notes: "Drink water and stretch",
    date: "2026-09-16",
    priority: true,
  });
  assert(act1 && act1.id, "createActivity failed");
  assert.strictEqual(act1.completed, false, "activity should initially be uncompleted");

  const actList = await db.getActivities(user.id);
  assert(actList.length >= 1, "getActivities returned empty list");
  assert(actList.some((a) => a.id === act1.id), "created activity not found in list");

  const toggled = await db.toggleActivity(act1.id, user.id, "08:30 AM");
  assert(toggled && toggled.completed === true, "toggleActivity failed");
  assert.strictEqual(toggled.time, "08:30 AM", "completed time mismatch");

  const updatedAct = await db.updateActivity(act1.id, user.id, {
    title: "Morning Routine Updated",
    priority: false,
  });
  assert.strictEqual(updatedAct.title, "Morning Routine Updated", "updateActivity failed");

  // 4. Quest tests
  const quest = await db.createQuest({
    userId: user.id,
    questType: "daily",
    theme: "onepiece",
    titleText: "Daily Training: Clear 3 tasks",
    target: 3,
  });
  assert(quest && quest.id, "createQuest failed");

  const questList = await db.getQuests(user.id);
  assert(questList.some((q) => q.id === quest.id), "getQuests failed");

  const updatedQuest = await db.updateQuest(quest.id, {
    status: "completed",
    completedAt: new Date().toISOString(),
  });
  assert.strictEqual(updatedQuest.status, "completed", "updateQuest failed");

  // 5. Badge tests
  const badge = await db.createBadge({
    userId: user.id,
    badgeKey: "xp:100",
    theme: "onepiece",
  });
  assert(badge && badge.id, "createBadge failed");

  const badges = await db.getBadges(user.id);
  assert(badges.some((b) => b.badgeKey === "xp:100"), "getBadges failed");

  // 6. User Progress tests
  await db.saveUserProgress(user.id, {
    userId: user.id,
    xp: 150,
    level: 2,
    theme: "onepiece",
    mentor: "zoro",
    streakCached: 2,
    mentorEvent: "level_up",
    mentorText: "Well done.",
  });
  const progress = await db.getUserProgress(user.id);
  assert(progress && progress.xp === 150, "saveUserProgress/getUserProgress failed");

  // 7. Activity Deletion
  await db.deleteActivity(act1.id, user.id);
  const actListAfterDelete = await db.getActivities(user.id);
  assert(!actListAfterDelete.some((a) => a.id === act1.id), "deleteActivity failed");

  // 8. Session Deletion
  await db.deleteSession(testToken);
  const deletedSession = await db.findSession(testToken);
  assert(!deletedSession, "deleteSession failed");

  console.log("=== All Database Adapter Tests Passed Successfully! ===");
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test failure:", err);
    process.exit(1);
  });
