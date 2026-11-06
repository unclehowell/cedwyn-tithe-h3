import { onMcp } from "./_shared/api.mjs";

export async function onRequest(context) {
  return onMcp(context.request);
}
