import { onRoot } from "./_shared/api.mjs";

export async function onRequest(context) {
  return onRoot(context);
}
