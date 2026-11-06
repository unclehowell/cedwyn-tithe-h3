import test from "node:test";
import assert from "node:assert/strict";
import { handleCollection, onMcp, onRoot, contractInternals } from "../functions/_shared/api.mjs";

const ORIGIN = "https://preview.example.test";
const modernMeta = { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientInfo": { name: "contract-test", version: "1.0.0" }, "io.modelcontextprotocol/clientCapabilities": {} };

function get(path = "/api/v1", headers = {}) { return new Request(ORIGIN + path, { method: "GET", headers }); }
function modernRpc(method, params = {}, id = 1, extraHeaders = {}) {
  return new Request(ORIGIN + "/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", "accept": "application/json, text/event-stream", "mcp-protocol-version": "2026-07-28", "mcp-method": method, ...(method === "resources/read" ? { "mcp-name": params.uri } : {}), ...extraHeaders },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params: { ...params, _meta: modernMeta } })
  });
}
async function json(response) { return response.json(); }

test("API root keeps normal browser HTML behavior", async () => {
  let called = false;
  const response = await onRoot({ request: get("/", { accept: "text/html,application/xhtml+xml" }), next: async () => { called = true; return new Response("existing html", { headers: { "content-type": "text/html" } }); } });
  assert.equal(called, true);
  assert.equal(await response.text(), "existing html");
});

test("root negotiates JSON without replacing browser HTML", async () => {
  const response = await onRoot({ request: get("/", { accept: "application/json" }), next: async () => new Response("should not be called") });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/json/);
  const body = await json(response);
  assert.equal(body.dataset.mode, "fixture-only");
  assert.equal(body.items.length, 3);
});

test("root negotiates valid XML and escapes XML metacharacters", async () => {
  const response = await onRoot({ request: get("/", { accept: "application/xml" }), next: async () => new Response("should not be called") });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/xml/);
  const body = await response.text();
  assert.match(body, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(body, /<cedwyn-api /);
  assert.match(body, /fixture-only/);
  assert.match(body, /Synthetic &lt;public&gt; &amp; escaped catalogue entry/);
});

test("collection endpoint paginates with a bounded limit", async () => {
  const firstBody = await json(await handleCollection(get("/api/v1?limit=1&offset=0")));
  assert.equal(firstBody.items.length, 1);
  assert.equal(firstBody.pagination.next, `${ORIGIN}/api/v1?limit=1&offset=1`);
  const second = await json(await handleCollection(get("/api/v1?limit=1&offset=1")));
  assert.equal(second.items[0].id, "urn:cedwyn:fixture:tithe-h3:record:0002");
});

test("invalid pagination and unrecognised/private filters fail closed", async () => {
  assert.equal((await handleCollection(get("/api/v1?limit=0"))).status, 400);
  assert.equal((await handleCollection(get("/api/v1?offset=-1"))).status, 400);
  assert.equal((await handleCollection(get("/api/v1?offset=10001"))).status, 400);
  assert.equal((await handleCollection(get("/api/v1?include_private=true"))).status, 400);
  assert.equal((await handleCollection(get("/api/v1?fields=*"))).status, 400);
});

test("public field allowlist excludes fixture-only private fields", async () => {
  for (const request of [get("/api/v1"), get("/api/v1", { accept: "application/xml" })]) {
    const body = await (await handleCollection(request)).text();
    assert.doesNotMatch(body, /PRIVATE_CANARY|private-fixture@example\.invalid|internal_note|contact_email/);
  }
});

test("cache validators and public cache policy are explicit", async () => {
  const first = await handleCollection(get("/api/v1"));
  assert.match(first.headers.get("cache-control"), /max-age=60/);
  const second = await handleCollection(get("/api/v1", { "if-none-match": first.headers.get("etag") }));
  assert.equal(second.status, 304);
});

test("modern MCP server discovery advertises current stateless protocol", async () => {
  const body = await json(await onMcp(modernRpc("server/discover")));
  assert.equal(body.result.protocolVersion, "2026-07-28");
  assert.equal(body.result.serverInfo.name, "cedwyn-tithe-h3-fixture");
});

test("MCP resources/list and resources/read return the allowlisted fixture", async () => {
  const listed = await json(await onMcp(modernRpc("resources/list")));
  assert.equal(listed.result.resources[0].uri, contractInternals.RESOURCE_URI);
  const content = await json(await onMcp(modernRpc("resources/read", { uri: contractInternals.RESOURCE_URI })));
  assert.equal(content.result.contents[0].mimeType, "application/json");
  assert.doesNotMatch(content.result.contents[0].text, /PRIVATE_CANARY|private-fixture@example\.invalid/);
});

test("legacy MCP initialize remains available only on the legacy protocol", async () => {
  const response = await onMcp(new Request(ORIGIN + "/mcp", { method: "POST", headers: { "content-type": "application/json", "mcp-protocol-version": "2025-11-25" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "legacy-test", version: "1.0.0" } } }) }));
  assert.equal(response.status, 200);
  assert.equal((await json(response)).result.protocolVersion, "2025-11-25");
});

test("MCP rejects cross-origin calls, bad JSON, mismatched headers and unknown resources", async () => {
  assert.equal((await onMcp(modernRpc("server/discover", {}, 1, { origin: "https://attacker.invalid" }))).status, 403);
  assert.equal((await onMcp(new Request(ORIGIN + "/mcp", { method: "POST", headers: { "content-type": "application/json", "mcp-protocol-version": "2026-07-28", "mcp-method": "server/discover" }, body: "{" }))).status, 400);
  assert.equal((await onMcp(modernRpc("server/discover", {}, 1, { "mcp-method": "resources/list" }))).status, 400);
  assert.equal((await onMcp(modernRpc("resources/read", { uri: "cedwyn://tithe-h3/private" }))).status, 404);
});

test("MCP rejects empty JSON-RPC objects and unsupported protocol versions", async () => {
  const empty = await onMcp(new Request(ORIGIN + "/mcp", { method: "POST", headers: { "content-type": "application/json", "mcp-protocol-version": "2026-07-28", "mcp-method": "server/discover" }, body: "{}" }));
  assert.equal(empty.status, 400);
  const unsupported = await onMcp(new Request(ORIGIN + "/mcp", { method: "POST", headers: { "content-type": "application/json", "mcp-protocol-version": "2024-11-05", "mcp-method": "server/discover" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "server/discover", params: { _meta: modernMeta } }) }));
  assert.equal(unsupported.status, 400);
  assert.equal((await handleCollection(get("/api/v1", { accept: "text/plain" }))).status, 406);
});

test("MCP requires POST and returns 405 for other methods", async () => {
  const response = await onMcp(new Request(ORIGIN + "/mcp", { method: "GET" }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});
