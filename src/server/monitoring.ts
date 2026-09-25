// src/server/monitoring.ts

export type EnvTarget = {
  name: string;
  kind: "http" | "heartbeat";
  url: string | null;
};

export function envTargets(): EnvTarget[] {
  const targets: EnvTarget[] = [];
  const argosUrl = process.env.ARGOS_BASE_URL
    ? `${process.env.ARGOS_BASE_URL.replace(/\/$/, "")}/health/ready`
    : null;
  if (argosUrl) {
    targets.push({
      name: "API Argos",
      kind: "http",
      url: argosUrl,
    });
  }
  const argusUrl = process.env.ARGUS_HEALTH_URL || null;
  if (argusUrl) {
    targets.push({
      name: "Serveur Argus",
      kind: "http",
      url: argusUrl,
    });
  }
  targets.push({
    name: "Heartbeat Argos",
    kind: "heartbeat",
    url: null,
  });
  return targets;
}
