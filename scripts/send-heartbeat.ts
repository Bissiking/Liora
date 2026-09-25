// scripts/send-heartbeat.ts
import { pathToFileURL } from "node:url";

function endpoint(value: string | undefined, name: string) {
  if (!value) throw Error(`${name} est requis.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw Error(`${name} est invalide.`);
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw Error(
      `${name} doit être une URL HTTP(S) sans identifiants ni fragment.`,
    );
  return url;
}

/** One attempt; scheduling belongs to Argus, never to the monitored receiver. */
export async function sendHeartbeat(env: NodeJS.ProcessEnv = process.env) {
  const destination = endpoint(env.LIORA_HEARTBEAT_URL, "LIORA_HEARTBEAT_URL");
  const health = endpoint(env.ARGOS_HEALTH_URL, "ARGOS_HEALTH_URL");
  const token = env.LIORA_SERVICE_TOKEN?.trim();
  if (!token || /\s/.test(token))
    throw Error(
      "LIORA_SERVICE_TOKEN est requis et ne doit pas contenir d’espaces.",
    );
  let ready: Response;
  try {
    ready = await fetch(health, {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!ready.ok) throw Error();
    if (ready.headers.get("content-type")?.includes("application/json")) {
      const payload = await ready.json();
      if (
        ["down", "critical", "unhealthy", "error"].includes(
          String(payload?.status).toLowerCase(),
        )
      )
        throw Error();
    } else {
      await ready.body?.cancel();
    }
  } catch {
    throw Error(
      "Argos ne confirme pas sa disponibilité ; aucun heartbeat envoyé.",
    );
  }
  try {
    const response = await fetch(destination, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw Error(`Liora a refusé le heartbeat (HTTP ${response.status}).`);
    }
    const receipt = await response.json();
    if (
      receipt?.ok !== true ||
      typeof receipt.received_at !== "string" ||
      !Number.isFinite(Date.parse(receipt.received_at))
    )
      throw Error("Liora n’a pas confirmé l’enregistrement du heartbeat.");
    return receipt.received_at as string;
  } catch (error) {
    // Only our own diagnostic messages are printed; never response bodies, URLs or tokens.
    if (error instanceof Error && error.message.startsWith("Liora "))
      throw error;
    throw Error(
      "Envoi impossible : vérifier la connexion à Liora et l’URL de réception.",
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(`Heartbeat enregistré par Liora à ${await sendHeartbeat()}`);
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Échec du heartbeat.",
    );
    process.exitCode = 1;
  }
}
