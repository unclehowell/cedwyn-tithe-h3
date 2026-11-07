import { handleCollection, loadView } from "../_shared/api.mjs";

export async function onRequest(context) {
  const view = await loadView(context.request);
  return handleCollection(context.request, { view });
}
