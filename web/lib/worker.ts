/** Calls the Python AI worker. Only ever called from the server. */
export async function callWorker(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: unknown }> {
  const base = process.env.WORKER_URL;
  if (!base) return { ok: false, status: 500, data: { error: "WORKER_URL is not set" } };
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Worker-Token": process.env.WORKER_TOKEN ?? "" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 502, data: { error: `Worker unreachable: ${(e as Error).message}` } };
  }
}
