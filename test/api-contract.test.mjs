import test from "node:test";
import assert from "node:assert/strict";
import { handleCollection, onMcp, onRoot, contractInternals } from "../functions/_shared/api.mjs";

const ORIGIN = "https://preview.example.test";
const view = {
  schema: "cedwyn.app-view/v1",
  app: { id: "tithe-h3", repository: "unclehowell/cedwyn-tithe-h3" },
  generated_utc: "2026-11-06T20:00:00Z",
  catalogue: {
    source: "https://cedwyn.bucklerfamily.estate/api/catalogue",
    synced_utc: "2026-11-06T20:00:00Z",
    count: 3,
    items: {
      "EV-0001": { id: "EV-0001", kind: "evidence", title: "Synthetic <public> & escaped catalogue entry", date_display: "1901", date_sort: "1901-00-00", status: "PUBLIC", page: "/research/evidence/ev-0001/", internal_note: "PRIVATE_CANARY_0001", contact_email: "private-fixture@example.invalid" },
      "EV-0002": { id: "EV-0002", kind: "evidence", title: "Synthetic catalogue entry 2", date_display: "1902", date_sort: "1902-00-00", status: "PUBLIC", page: null, internal_note: "PRIVATE_CANARY_0002" },
      "EV-0003": { id: "EV-0003", kind: "evidence", title: "Synthetic catalogue entry 3", date_display: "1903", date_sort: "1903-00-00", status: "PUBLIC", page: null, internal_note: "PRIVATE_CANARY_0003" }
    }
  },
  map: { pins: { records: [{}, {}, {}] } }
};
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
  const response = await onRoot({ request: get("/", { accept: "text/html,application/xhtml+xml" }), view, next: async () => { called = true; return new Response("existing html", { headers: { "content-type": "text/html" } }); } });
  assert.equal(called, true);
  assert.equal(await response.text(), "existing html");
});

test("root negotiates JSON and XML from the app-local view", async () => {
  const response = await onRoot({ request: get("/", { accept: "application/json" }), view, next: async () => new Response("should not be called") });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/json/);
  const body = await json(response);
  assert.equal(body.dataset.mode, "app-view");
  assert.equal(body.items.length, 3);
  const xml = await onRoot({ request: get("/", { accept: "application/xml" }), view, next: async () => new Response("should not be called") });
  assert.equal(xml.status, 200);
  assert.match(await xml.text(), /Synthetic &lt;public&gt; &amp; escaped catalogue entry/);
});

test("collection endpoint paginates and retains source provenance", async () => {
  const firstBody = await json(await handleCollection(get("/api/v1?limit=1&offset=0"), { view }));
  assert.equal(firstBody.items.length, 1);
  assert.equal(firstBody.items[0].id, "EV-0001");
  assert.equal(firstBody.items[0].source.url, "https://cedwyn.bucklerfamily.estate/api/catalogue/EV-0001");
  assert.equal(firstBody.pagination.next, ORIGIN + "/api/v1?limit=1&offset=1");
  const second = await json(await handleCollection(get("/api/v1?limit=1&offset=1"), { view }));
  assert.equal(second.items[0].id, "EV-0002");
});

test("missing app view fails closed rather than returning fixtures", async () => {
  assert.equal((await handleCollection(get("/api/v1"))).status, 503);
});

test("invalid pagination and unrecognised/private filters fail closed", async () => {
  assert.equal((await handleCollection(get("/api/v1?limit=0"), { view })).status, 400);
  assert.equal((await handleCollection(get("/api/v1?offset=-1"), { view })).status, 400);
  assert.equal((await handleCollection(get("/api/v1?offset=10001"), { view })).status, 400);
  assert.equal((await handleCollection(get("/api/v1?include_private=true"), { view })).status, 400);
  assert.equal((await handleCollection(get("/api/v1?fields=*"), { view })).status, 400);
});

test("explicit public-field allowlist excludes private canaries from source rows", async () => {
  for (const request of [get("/api/v1"), get("/api/v1", { accept: "application/xml" })]) {
    const body = await (await handleCollection(request, { view })).text();
    assert.doesNotMatch(body, /PRIVATE_CANARY|private-fixture@example\.invalid|internal_note|contact_email/);
  }
});

test("cache validators follow the app view version", async () => {
  const first = await handleCollection(get("/api/v1"), { view });
  const etag = first.headers.get("etag");
  assert.ok(etag.includes(view.generated_utc));
  const second = await handleCollection(get("/api/v1", { "if-none-match": etag }), { view });
  assert.equal(second.status, 304);
});

test("MCP exposes the same app-local catalogue view", async () => {
  const list = await json(await onMcp(modernRpc("resources/list"), { view }));
  assert.equal(list.result.resources[0].uri, contractInternals.RESOURCE_URI);
  const read = await json(await onMcp(modernRpc("resources/read", { uri: contractInternals.RESOURCE_URI }), { view }));
  const payload = JSON.parse(read.result.contents[0].text);
  assert.equal(payload.dataset.mode, "app-view");
  assert.equal(payload.items.length, 3);
});

test("MCP rejects cross-origin, oversized and unsupported protocol requests", async () => {
  const cross = await onMcp(modernRpc("resources/list", {}, 1, { origin: "https://evil.example" }), { view });
  assert.equal(cross.status, 403);
  const badVersion = new Request(ORIGIN + "/mcp", { method: "POST", headers: { "content-type": "application/json", "mcp-protocol-version": "1900-01-01" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "resources/list" }) });
  assert.equal((await onMcp(badVersion, { view })).status, 400);
  const oversized = new Request(ORIGIN + "/mcp", { method: "POST", headers: { "content-type": "application/json", "mcp-protocol-version": "2026-07-28" }, body: "x".repeat(17000) });
  assert.equal((await onMcp(oversized, { view })).status, 413);
});

test("API version and public field contract are explicit", () => {
  assert.equal(contractInternals.APP_ID, "tithe-h3");
  assert.equal(contractInternals.API_VERSION, "0.2.0");
  assert.deepEqual(contractInternals.PUBLIC_FIELDS, ["id", "kind", "title", "date_display", "date_sort", "status", "page", "source"]);
});
