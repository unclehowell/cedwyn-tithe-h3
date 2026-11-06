import { handleCollection } from "../_shared/api.mjs";

export async function onRequest(context) {
  return handleCollection(context.request, { defaultFormat: "json" });
}
