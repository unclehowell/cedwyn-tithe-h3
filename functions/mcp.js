import { onMcp, loadView } from "./_shared/api.mjs";

export async function onRequest(context) {
  const view = await loadView(context.request);
  return onMcp(context.request, { view });
}
