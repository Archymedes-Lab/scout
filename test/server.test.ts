import { afterAll, expect, test } from "bun:test";
import { createApi } from "../src/api.ts";
import { openStore } from "../src/db.ts";
import { createServer } from "../src/server.ts";

const server = createServer(createApi({ store: openStore(":memory:") }), 0);
afterAll(() => server.stop(true));

test("the engine binds loopback only and serves the API under /api", async () => {
  expect(server.hostname).toBe("127.0.0.1");
  expect((await fetch(`http://127.0.0.1:${server.port}/api/health`)).status).toBe(200);
  expect((await fetch(`http://127.0.0.1:${server.port}/api/nope`)).status).toBe(404);
  expect((await fetch(`http://127.0.0.1:${server.port}/`)).status).toBe(404);
});
