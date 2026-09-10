"use strict";

const { app } = require("@azure/functions");
const { getClientAccessUrl } = require("../shared/webpubsub");

// GET /api/negotiate — hands the browser a short-lived Web PubSub URL.
app.http("negotiate", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (_req, context) => {
    try {
      const url = await getClientAccessUrl();
      return {
        status: 200,
        jsonBody: { url },
        headers: { "Cache-Control": "no-store" },
      };
    } catch (err) {
      context.error("negotiate failed", err);
      return { status: 500, jsonBody: { error: String(err.message || err) } };
    }
  },
});
