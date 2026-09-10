"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { applyOp, isValidOp } = require("../src/shared/reducer");
const { seedBoard } = require("../src/shared/seed");

test("seed board is valid", () => {
  const b = seedBoard();
  assert.equal(b.id, "board");
  assert.equal(b.tasks.length, 11);
  assert.ok(b.members.includes("Francesco"));
});

test("addTask prepends and bumps rev", () => {
  const b = seedBoard();
  const next = applyOp(b, {
    type: "addTask",
    task: { id: "x", title: "New", desc: "", owner: "Unassigned", priority: "P3", status: "NEXT", notes: "", subtasks: [] },
  });
  assert.equal(next.tasks[0].id, "x");
  assert.equal(next.rev, b.rev + 1);
});

test("moveTask to WAITING stamps waitingSince; leaving clears it", () => {
  let b = seedBoard();
  b = applyOp(b, { type: "moveTask", id: "1", status: "WAITING" });
  assert.ok(b.tasks.find((t) => t.id === "1").waitingSince);
  b = applyOp(b, { type: "moveTask", id: "1", status: "DONE" });
  assert.equal(b.tasks.find((t) => t.id === "1").waitingSince, undefined);
});

test("deleteTask removes", () => {
  const b = applyOp(seedBoard(), { type: "deleteTask", id: "1" });
  assert.equal(b.tasks.find((t) => t.id === "1"), undefined);
});

test("weekly add/update/delete/clear", () => {
  let b = seedBoard();
  b = applyOp(b, { type: "weeklyAdd", column: "well", item: { id: "z", text: "hi" } });
  assert.ok(b.weekly.well.find((i) => i.id === "z"));
  b = applyOp(b, { type: "weeklyUpdate", column: "well", id: "z", text: "bye" });
  assert.equal(b.weekly.well.find((i) => i.id === "z").text, "bye");
  b = applyOp(b, { type: "weeklyDelete", column: "well", id: "z" });
  assert.equal(b.weekly.well.find((i) => i.id === "z"), undefined);
  b = applyOp(b, { type: "weeklyClear" });
  assert.equal(b.weekly.well.length, 0);
});

test("setDueDate sets and clears", () => {
  let b = applyOp(seedBoard(), { type: "setDueDate", id: "7", dueDate: "2026-06-01" });
  assert.equal(b.tasks.find((t) => t.id === "7").dueDate, "2026-06-01");
  b = applyOp(b, { type: "setDueDate", id: "7" });
  assert.equal(b.tasks.find((t) => t.id === "7").dueDate, undefined);
});

test("isValidOp rejects junk", () => {
  assert.equal(isValidOp(null), false);
  assert.equal(isValidOp({ type: "nope" }), false);
  assert.equal(isValidOp({ type: "weeklyClear" }), true);
});
