"use strict";

const { CosmosClient } = require("@azure/cosmos");
const { seedBoard } = require("./seed");

let containerPromise = null;

function getContainer() {
  if (!containerPromise) {
    const conn = process.env.COSMOS_CONNECTION_STRING;
    if (!conn) throw new Error("COSMOS_CONNECTION_STRING is not configured");
    const dbName = process.env.COSMOS_DATABASE || "gtd";
    const containerName = process.env.COSMOS_CONTAINER || "board";
    const client = new CosmosClient(conn);

    containerPromise = (async () => {
      const { database } = await client.databases.createIfNotExists({ id: dbName });
      const { container } = await database.containers.createIfNotExists({
        id: containerName,
        partitionKey: { paths: ["/id"] },
      });
      return container;
    })();
  }
  return containerPromise;
}

// Read the single board document, seeding it on first run.
async function readBoard() {
  const container = await getContainer();
  try {
    const { resource } = await container.item("board", "board").read();
    if (resource) return resource;
  } catch (err) {
    if (err.code !== 404) throw err;
  }
  const seeded = seedBoard();
  const { resource } = await container.items.upsert(seeded);
  return resource;
}

// Apply a mutation with optimistic-concurrency retries so that concurrent
// edits from multiple users merge instead of clobbering each other.
async function mutateBoard(applyFn, maxRetries = 6) {
  const container = await getContainer();
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const current = await readBoard();
    const next = applyFn(current);
    // Preserve the system id; carry the etag for the conditional write.
    next.id = "board";
    try {
      const { resource } = await container
        .item("board", "board")
        .replace(next, {
          accessCondition: { type: "IfMatch", condition: current._etag },
        });
      return resource;
    } catch (err) {
      if (err.code === 412 && attempt < maxRetries) {
        attempt += 1;
        continue; // someone else wrote first — retry against fresh state
      }
      throw err;
    }
  }
}

module.exports = { readBoard, mutateBoard };
