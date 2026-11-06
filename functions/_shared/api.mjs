const APP_ID = "tithe-h3";
const API_VERSION = "0.2.0";
const RESOURCE_URI = "cedwyn://tithe-h3/catalogue";
const MODERN_MCP_VERSION = "2026-07-28";
const LEGACY_MCP_VERSION = "2025-11-25";
const PUBLIC_FIELDS = Object.freeze(["id", "kind", "title", "date_display", "date_sort", "status", "page", "source"]);
const COMMON_HEADERS = Object.freeze({
  "x-cedwyn-app": APP_ID,
  "x-cedwyn-api-version": API_VERSION,
  "vary": "Accept",
  "cache-control": "public, max-age=60, stale-while-revalidate=300"
});

export async function loadView(request) {
  try {
    const response = await fetch(new URL("/data/view.json", request.url), { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const view = await response.json();
    if (view?.schema !== "cedwyn.app-view/v1" || view?.app?.id !== APP_ID || !view?.catalogue?.items || typeof view.catalogue.items !== "object") return null;
    return view;
  } catch {
    return null;
  }
}

function projectPublic(row, catalogueSource) {
  // Explicit field allowlist: never spread a central source record into an API response.
  return Object.fromEntries(PUBLIC_FIELDS.map((field) => [
    field,
    field === "source"
      ? { type: "central-catalogue", url: catalogueSource + "/" + encodeURIComponent(row.id) }
      : (row[field] ?? null)
  ]));
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
  const items = payload.items.map((item) => {
    const fields = PUBLIC_FIELDS.map((field) => {
      const value = item[field];
      if (field === "source") return '      <source type="' + xmlEscape(value?.type || "") + '"><url>' + xmlEscape(value?.url || "") + '</url></source>';
      return "      <" + field + ">" + xmlEscape(value === null ? "" : value) + "</" + field + ">";
    }).join("\n");
    return "    <item>\n" + fields + "\n    </item>";
  }).join("\n");
  return '<?xml version="1.0" encoding="UTF-8"?>\n<cedwyn-api schema="cedwyn.app-api/v1" app="' + APP_ID + '" version="' + API_VERSION + '">\n' +
    '  <dataset id="' + xmlEscape(payload.dataset.id) + '" mode="' + xmlEscape(payload.dataset.mode) + '">' + xmlEscape(payload.dataset.note) + '</dataset>\n' +
    '  <provenance source="' + xmlEscape(payload.provenance.catalogue_source) + '" synced_utc="' + xmlEscape(payload.provenance.synced_utc) + '" />\n' +
    '  <pagination limit="' + payload.pagination.limit + '" offset="' + payload.pagination.offset + '" total="' + payload.pagination.total + '" has_more="' + payload.pagination.has_more + '" />\n' +
    "  <items>\n" + items + "\n  </items>\n</cedwyn-api>";
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

function buildPayload(request, view) {
  const url = new URL(request.url);
  const allowedParams = new Set(["limit", "offset", "format"]);
  for (const key of url.searchParams.keys()) {
    if (!allowedParams.has(key)) return { error: problem(400, "Unsupported query parameter", "The parameter '" + key + "' is not part of the public API contract.") };
  }
  const rawLimit = url.searchParams.get("limit"), rawOffset = url.searchParams.get("offset");
  const limit = rawLimit === null ? 20 : Number(rawLimit), offset = rawOffset === null ? 0 : Number(rawOffset);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) return { error: problem(400, "Invalid limit", "limit must be an integer from 1 to 50.") };
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return { error: problem(400, "Invalid offset", "offset must be an integer from 0 to 10000.") };
  const catalogue = view.catalogue;
  const all = Object.values(catalogue.items).map((row) => projectPublic(row, catalogue.source));
  all.sort((a, b) => String(a.date_sort || "").localeCompare(String(b.date_sort || "")) || String(a.id).localeCompare(String(b.id)));
  const items = all.slice(offset, offset + limit);
  const nextOffset = offset + items.length < all.length ? offset + items.length : null;
  const next = nextOffset === null ? null : url.origin + url.pathname + "?limit=" + limit + "&offset=" + nextOffset;
  return { payload: {
    schema: "cedwyn.app-api/v1", app: APP_ID, api_version: API_VERSION,
    dataset: { id: "tithe-h3-app-view", mode: "app-view", note: "The app-local view combines map-owned data with the public central-catalogue fields used by Tithe H3." },
    provenance: {
      repository: "unclehowell/cedwyn-tithe-h3",
      view_path: "data/view.json",
      catalogue_source: catalogue.source,
      synced_utc: catalogue.synced_utc,
      public_catalogue_records: catalogue.count,
      map_record_count: view.map?.pins?.records?.length || 0
    },
    public_fields: PUBLIC_FIELDS,
    pagination: { limit, offset, total: all.length, has_more: nextOffset !== null, next },
    items
  } };
}

export function handleCollection(request, { defaultFormat = "json", view } = {}) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { ...COMMON_HEADERS, allow: "GET, HEAD", "cache-control": "no-store" } });
  if (!view) return problem(503, "App view unavailable", "The generated app-local data/view.json is not available or has an invalid schema.");
  const format = chooseFormat(request, defaultFormat);
  if (format === "invalid") return problem(400, "Invalid format", "format must be json or xml.");
  if (format === "none") return problem(406, "Not acceptable", "Use Accept: application/json or application/xml.");
  const built = buildPayload(request, view);
  if (built.error) return built.error;
  const headers = {
    ...COMMON_HEADERS,
    etag: 'W/"' + APP_ID + "-" + API_VERSION + "-" + view.generated_utc + "-" + built.payload.pagination.offset + "-" + built.payload.pagination.limit + '"',
    "content-type": format === "xml" ? "application/xml; charset=utf-8" : "application/json; charset=utf-8"
  };
  if (request.headers.get("if-none-match") === headers.etag) return new Response(null, { status: 304, headers });
  const body = format === "xml" ? asXml(built.payload) : JSON.stringify(built.payload, null, 2);
  return new Response(request.method === "HEAD" ? null : body, { status: 200, headers });
}

export async function onRoot(context) {
  const format = chooseFormat(context.request, "html");
  if (format === "html" || format === "none") return context.next();
  if (format === "invalid") return problem(400, "Invalid format", "format must be json or xml.");
  const view = context.view || await loadView(context.request);
  return handleCollection(context.request, { defaultFormat: format, view });
}

function rpcError(id, code, message, status = 400, data = undefined) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error }), { status, headers: { ...COMMON_HEADERS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function rpcResult(id, result, status = 200) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), { status, headers: { ...COMMON_HEADERS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

export async function onMcp(request, { view } = {}) {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { ...COMMON_HEADERS, allow: "POST", "cache-control": "no-store" } });
  if (!view) return problem(503, "App view unavailable", "The generated app-local data/view.json is not available or has an invalid schema.");
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
    return rpcResult(message.id, { protocolVersion: LEGACY_MCP_VERSION, capabilities: { resources: { subscribe: false, listChanged: false } }, serverInfo: { name: "cedwyn-tithe-h3", version: API_VERSION }, instructions: "The resource is the app-local Tithe H3 view, with public catalogue metadata and app-owned map data." });
  }
  if (isModern && message.method === "server/discover") return rpcResult(message.id, { resultType: "complete", protocolVersion: MODERN_MCP_VERSION, capabilities: { resources: { listChanged: false } }, serverInfo: { name: "cedwyn-tithe-h3", version: API_VERSION }, ttlMs: 60000, cacheScope: "public", instructions: "Read the Tithe H3 app-local view. Central catalogue fields are read-only public projections; map data is app-owned." });
  if (message.method === "resources/list") return rpcResult(message.id, { ...(isModern ? { resultType: "complete", ttlMs: 60000, cacheScope: "public" } : {}), resources: [{ uri: RESOURCE_URI, name: "Tithe H3 public catalogue view", title: "Tithe H3 public catalogue view", description: "The app-local view of public central-catalogue records referenced by the Tithe H3 map.", mimeType: "application/json" }] });
  if (message.method === "resources/read") {
    if (message.params?.uri !== RESOURCE_URI) return rpcError(message.id, -32602, "Unknown resource URI", 404);
    const payload = buildPayload(new Request("https://view.invalid/api/v1"), view);
    return rpcResult(message.id, { ...(isModern ? { resultType: "complete", ttlMs: 60000, cacheScope: "public" } : {}), contents: [{ uri: RESOURCE_URI, mimeType: "application/json", text: JSON.stringify(payload.payload) }] });
  }
  return rpcError(message.id, -32601, "Method not found", 404);
}

export const contractInternals = Object.freeze({ APP_ID, API_VERSION, RESOURCE_URI, MODERN_MCP_VERSION, LEGACY_MCP_VERSION, PUBLIC_FIELDS });
