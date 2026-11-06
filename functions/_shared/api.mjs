const APP_ID = "tithe-h3";
const API_VERSION = "0.1.0";
const RESOURCE_URI = "cedwyn://tithe-h3/catalogue";
const MODERN_MCP_VERSION = "2026-07-28";
const LEGACY_MCP_VERSION = "2025-11-25";

// Synthetic fixtures only. The real app projection is data/central.json, but it is
// a generated static JSON file, not a bound app-local database. Never serve it as
// a live API until the app-local backend and access controls are implemented.
const FIXTURE_ROWS = Object.freeze([
  Object.freeze({
    id: "urn:cedwyn:fixture:tithe-h3:record:0001",
    kind: "fixture",
    title: "Synthetic <public> & escaped catalogue entry — not a historical record",
    date_display: "fixture only",
    date_sort: "0000-00-00",
    status: "FIXTURE",
    page: null,
    source: { type: "synthetic-fixture", repository: "unclehowell/cedwyn-tithe-h3", path: "functions/_shared/api.mjs" },
    internal_note: "PRIVATE_CANARY_DO_NOT_RETURN_0001",
    contact_email: "private-fixture@example.invalid"
  }),
  Object.freeze({
    id: "urn:cedwyn:fixture:tithe-h3:record:0002",
    kind: "fixture",
    title: "Synthetic public catalogue entry 2 — not a historical record",
    date_display: "fixture only",
    date_sort: "0000-00-00",
    status: "FIXTURE",
    page: null,
    source: { type: "synthetic-fixture", repository: "unclehowell/cedwyn-tithe-h3", path: "functions/_shared/api.mjs" },
    internal_note: "PRIVATE_CANARY_DO_NOT_RETURN_0002",
    contact_email: "private-fixture@example.invalid"
  }),
  Object.freeze({
    id: "urn:cedwyn:fixture:tithe-h3:record:0003",
    kind: "fixture",
    title: "Synthetic public catalogue entry 3 — not a historical record",
    date_display: "fixture only",
    date_sort: "0000-00-00",
    status: "FIXTURE",
    page: null,
    source: { type: "synthetic-fixture", repository: "unclehowell/cedwyn-tithe-h3", path: "functions/_shared/api.mjs" },
    internal_note: "PRIVATE_CANARY_DO_NOT_RETURN_0003",
    contact_email: "private-fixture@example.invalid"
  })
]);

const PUBLIC_FIELDS = Object.freeze(["id", "kind", "title", "date_display", "date_sort", "status", "page", "source"]);
const COMMON_HEADERS = Object.freeze({
  "x-cedwyn-app": APP_ID,
  "x-cedwyn-api-version": API_VERSION,
  "vary": "Accept",
  "cache-control": "public, max-age=60, stale-while-revalidate=300"
});

function projectPublic(row) {
  // Explicit allowlist: do not spread source records into an API response.
  return Object.fromEntries(PUBLIC_FIELDS.map((field) => [field, row[field] ?? null]));
}

function problem(status, title, detail, extra = {}) {
  return new Response(JSON.stringify({ type: "about:blank", title, status, detail, ...extra }), {
    status,
    headers: { ...COMMON_HEADERS, "content-type": "application/problem+json; charset=utf-8", "cache-control": "no-store" }
  });
}

function xmlEscape(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function asXml(payload) {
  const items = payload.items.map((item) => `    <item>\n${PUBLIC_FIELDS.map((field) => {
    const value = item[field];
    if (field === "source") return `      <source type="${xmlEscape(value?.type || "")}"><repository>${xmlEscape(value?.repository || "")}</repository><path>${xmlEscape(value?.path || "")}</path></source>`;
    return `      <${field}>${xmlEscape(value === null ? "" : value)}</${field}>`;
  }).join("\n")}\n    </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<cedwyn-api schema="cedwyn.app-api/v1" app="${APP_ID}" version="${API_VERSION}">\n  <dataset id="${payload.dataset.id}" mode="${payload.dataset.mode}">${xmlEscape(payload.dataset.note)}</dataset>\n  <pagination limit="${payload.pagination.limit}" offset="${payload.pagination.offset}" total="${payload.pagination.total}" has_more="${payload.pagination.has_more}" />\n  <items>\n${items}\n  </items>\n</cedwyn-api>`;
}

function chooseFormat(request, defaultFormat) {
  const url = new URL(request.url);
  const explicit = url.searchParams.get("format");
  if (explicit) return explicit === "json" || explicit === "xml" ? explicit : "invalid";
  const accept = (request.headers.get("accept") || "").toLowerCase();
  if (accept.includes("application/xml") || accept.includes("text/xml")) return "xml";
  if (accept.includes("application/json") || accept.includes("application/*")) return "json";
  if (!accept || accept.includes("*/*")) return defaultFormat;
  if (defaultFormat === "html" && (accept.includes("text/html") || accept.includes("application/xhtml+xml"))) return "html";
  return "none";
}

function buildPayload(request) {
  const url = new URL(request.url);
  const allowedParams = new Set(["limit", "offset", "format"]);
  for (const key of url.searchParams.keys()) {
    if (!allowedParams.has(key)) return { error: problem(400, "Unsupported query parameter", `The parameter '${key}' is not part of the public API contract.`) };
  }
  const rawLimit = url.searchParams.get("limit"), rawOffset = url.searchParams.get("offset");
  const limit = rawLimit === null ? 20 : Number(rawLimit), offset = rawOffset === null ? 0 : Number(rawOffset);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) return { error: problem(400, "Invalid limit", "limit must be an integer from 1 to 50.") };
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return { error: problem(400, "Invalid offset", "offset must be an integer from 0 to 10000.") };
  const all = FIXTURE_ROWS.map(projectPublic), items = all.slice(offset, offset + limit);
  const nextOffset = offset + items.length < all.length ? offset + items.length : null;
  const next = nextOffset === null ? null : `${url.origin}${url.pathname}?limit=${limit}&offset=${nextOffset}`;
  return { payload: {
    schema: "cedwyn.app-api/v1", app: APP_ID, api_version: API_VERSION,
    dataset: { id: "tithe-h3-fixture-catalogue", mode: "fixture-only", note: "Synthetic test data only. Not connected to data/central.json, a D1 database, or live evidence records." },
    provenance: { repository: "unclehowell/cedwyn-tithe-h3", fixture_path: "functions/_shared/api.mjs", central_projection: "data/central.json exists but is not read by this fixture API", generated_at: null },
    public_fields: PUBLIC_FIELDS,
    pagination: { limit, offset, total: all.length, has_more: nextOffset !== null, next },
    items
  } };
}

export function handleCollection(request, { defaultFormat = "json" } = {}) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { ...COMMON_HEADERS, allow: "GET, HEAD", "cache-control": "no-store" } });
  const format = chooseFormat(request, defaultFormat);
  if (format === "invalid") return problem(400, "Invalid format", "format must be json or xml.");
  if (format === "none") return problem(406, "Not acceptable", "Use Accept: application/json or application/xml.");
  const built = buildPayload(request);
  if (built.error) return built.error;
  const headers = { ...COMMON_HEADERS, etag: `W/\"${APP_ID}-${API_VERSION}-fixture-${built.payload.pagination.offset}-${built.payload.pagination.limit}\"`, "content-type": format === "xml" ? "application/xml; charset=utf-8" : "application/json; charset=utf-8" };
  if (request.headers.get("if-none-match") === headers.etag) return new Response(null, { status: 304, headers });
  const body = format === "xml" ? asXml(built.payload) : JSON.stringify(built.payload, null, 2);
  return new Response(request.method === "HEAD" ? null : body, { status: 200, headers });
}

export async function onRoot(context) {
  const format = chooseFormat(context.request, "html");
  if (format === "html" || format === "none") return context.next();
  if (format === "invalid") return problem(400, "Invalid format", "format must be json or xml.");
  return handleCollection(context.request, { defaultFormat: format });
}

function rpcError(id, code, message, status = 400, data = undefined) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error }), { status, headers: { ...COMMON_HEADERS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function rpcResult(id, result, status = 200) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), { status, headers: { ...COMMON_HEADERS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

export async function onMcp(request) {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { ...COMMON_HEADERS, allow: "POST", "cache-control": "no-store" } });
  const url = new URL(request.url), origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return problem(403, "Origin not allowed", "Cross-origin MCP requests are rejected.");
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return problem(415, "Unsupported media type", "MCP requests must use application/json.");
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 16384) return problem(413, "Request too large", "MCP request bodies are limited to 16 KiB.");
  let message;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 16384) return problem(413, "Request too large", "MCP request bodies are limited to 16 KiB.");
    message = JSON.parse(raw);
  } catch { return problem(400, "Invalid JSON", "The MCP request body must be one JSON-RPC object."); }
  if (!message || typeof message !== "object" || Array.isArray(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") return rpcError(message?.id, -32600, "Invalid Request");

  const isNotification = !Object.prototype.hasOwnProperty.call(message, "id"), version = request.headers.get("mcp-protocol-version");
  if (![MODERN_MCP_VERSION, LEGACY_MCP_VERSION].includes(version)) return rpcError(message.id, -32000, "Unsupported protocol version", 400, { supported: [MODERN_MCP_VERSION, LEGACY_MCP_VERSION] });
  const isModern = version === MODERN_MCP_VERSION;
  if (isModern) {
    const bodyVersion = message.params?._meta?.["io.modelcontextprotocol/protocolVersion"];
    if (bodyVersion !== version) return rpcError(message.id, -32000, "Protocol version header mismatch", 400, { expected: version, received: bodyVersion || null });
    if (request.headers.get("mcp-method") !== message.method) return rpcError(message.id, -32600, "Mcp-Method header must match the JSON-RPC method", 400);
    if (message.method === "resources/read" && request.headers.get("mcp-name") !== message.params?.uri) return rpcError(message.id, -32600, "Mcp-Name header must match params.uri", 400);
  }
  if (isNotification) {
    if (!isModern && message.method === "notifications/initialized") return new Response(null, { status: 202, headers: { ...COMMON_HEADERS, "cache-control": "no-store" } });
    return rpcError(null, -32600, "Notifications are not supported for this method", 400);
  }
  if (!isModern && message.method === "initialize") {
    if (message.params?.protocolVersion !== LEGACY_MCP_VERSION) return rpcError(message.id, -32000, "Unsupported legacy protocol version", 400, { supported: [LEGACY_MCP_VERSION] });
    return rpcResult(message.id, { protocolVersion: LEGACY_MCP_VERSION, capabilities: { resources: { subscribe: false, listChanged: false } }, serverInfo: { name: "cedwyn-tithe-h3-fixture", version: API_VERSION }, instructions: "Fixture-only preview. No live records or private data are available." });
  }
  if (isModern && message.method === "server/discover") return rpcResult(message.id, { resultType: "complete", protocolVersion: MODERN_MCP_VERSION, capabilities: { resources: { listChanged: false } }, serverInfo: { name: "cedwyn-tithe-h3-fixture", version: API_VERSION }, ttlMs: 60000, cacheScope: "public", instructions: "Fixture-only preview. The resource contains synthetic data and is not connected to the live app dataset." });
  if (message.method === "resources/list") return rpcResult(message.id, { ...(isModern ? { resultType: "complete", ttlMs: 60000, cacheScope: "public" } : {}), resources: [{ uri: RESOURCE_URI, name: "Tithe H3 synthetic catalogue fixture", title: "Tithe H3 synthetic catalogue fixture", description: "Synthetic API contract test data only; not a historical record or live catalogue projection.", mimeType: "application/json" }] });
  if (message.method === "resources/read") {
    if (message.params?.uri !== RESOURCE_URI) return rpcError(message.id, -32602, "Unknown resource URI", 404);
    const payload = buildPayload(new Request("https://fixture.invalid/api/v1"));
    return rpcResult(message.id, { ...(isModern ? { resultType: "complete", ttlMs: 60000, cacheScope: "public" } : {}), contents: [{ uri: RESOURCE_URI, mimeType: "application/json", text: JSON.stringify(payload.payload) }] });
  }
  return rpcError(message.id, -32601, "Method not found", 404);
}

export const contractInternals = Object.freeze({ APP_ID, API_VERSION, RESOURCE_URI, MODERN_MCP_VERSION, LEGACY_MCP_VERSION, PUBLIC_FIELDS, FIXTURE_COUNT: FIXTURE_ROWS.length });