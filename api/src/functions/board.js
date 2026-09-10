"use strict";

const { app } = require("@azure/functions");
const { readBoard, mutateBoard } = require("../shared/cosmos");
const { broadcastState } = require("../shared/webpubsub");
const { applyOp, isValidOp } = require("../shared/reducer");

const noStore = { "Cache-Control": "no-store", "Content-Type": "application/json" };

// GET /api/board — current authoritative board (seeded on first call).
// POST /api/board — apply one operation, persist, broadcast, return new board.
app.http("board", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (req, context) => {
    try {
      if (req.method === "GET") {
        const board = await readBoard();
        return { status: 200, jsonBody: board, headers: noStore };
      }

      const op = await req.json().catch(() => null);
      if (!isValidOp(op)) {
        return {
          status: 400,
          jsonBody: { error: "Invalid or unknown operation" },
          headers: noStore,
        };
      }

      const board = await mutateBoard((current) => applyOp(current, op));

      // Fan out to every connected client. Failure to broadcast must not
      // fail the write — the caller still gets the authoritative result and
      // other clients pick it up on their next resync.
      try {
        await broadcastState(board);
      } catch (err) {
        context.error("broadcast failed", err);
      }

      return { status: 200, jsonBody: board, headers: noStore };
    } catch (err) {
      context.error("board handler failed", err);
      return {
        status: 500,
        jsonBody: { error: String(err.message || err) },
        headers: noStore,
      };
    }
  },
});
