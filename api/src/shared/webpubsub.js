"use strict";

const { WebPubSubServiceClient } = require("@azure/web-pubsub");

let serviceClient = null;

function getServiceClient() {
  if (!serviceClient) {
    const conn = process.env.WEBPUBSUB_CONNECTION_STRING;
    if (!conn) throw new Error("WEBPUBSUB_CONNECTION_STRING is not configured");
    const hub = process.env.WEBPUBSUB_HUB || "boardhub";
    serviceClient = new WebPubSubServiceClient(conn, hub);
  }
  return serviceClient;
}

// A short-lived client access URL for a browser to connect to Web PubSub.
async function getClientAccessUrl() {
  const client = getServiceClient();
  const token = await client.getClientAccessToken({
    roles: ["webpubsub.joinLeaveGroup", "webpubsub.sendToGroup"],
  });
  return token.url;
}

// Broadcast the full board state to every connected client.
async function broadcastState(board) {
  const client = getServiceClient();
  await client.sendToAll(
    { type: "state", board },
    { contentType: "application/json" }
  );
}

module.exports = { getClientAccessUrl, broadcastState };
