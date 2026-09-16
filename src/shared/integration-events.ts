// src/shared/integration-events.ts
export function matchesEvent(pattern: string, type: string) {
  return (
    pattern === "*" ||
    (pattern.endsWith(".*")
      ? type.startsWith(pattern.slice(0, -1))
      : pattern === type)
  );
}
export function normalizeIntegrationEvent(
  provider: string,
  body: any,
  githubEvent?: string,
) {
  if (provider === "github") {
    const repo = String(body.repository?.full_name || "GitHub").slice(0, 150);
    const event = String(githubEvent || "").replace(/[^a-z_]/g, "");
    if (
      ![
        "push",
        "issues",
        "pull_request",
        "workflow_run",
        "release",
        "ping",
      ].includes(event)
    )
      throw Error("Événement GitHub non pris en charge");
    const item =
      body.issue || body.pull_request || body.workflow_run || body.release;
    const title = String(
      item?.title ||
        item?.name ||
        body.head_commit?.message ||
        "Événement reçu",
    )
      .split("\n")[0]
      .slice(0, 300);
    const action = String(
      body.action || (event === "push" ? "updated" : "received"),
    )
      .replace(/[^a-z_]/g, "")
      .slice(0, 50);
    const url = String(
      item?.html_url || body.compare || body.repository?.html_url || "",
    );
    return {
      type: `github.${event}.${action}`,
      content: `${repo} · ${title}${/^https:\/\//.test(url) ? `\n${url}` : ""}`,
      severity: item?.conclusion === "failure" ? "error" : "info",
      payload: { repository: repo, action, title, url },
    };
  }
  const type = String(body.type || `${provider}.event`);
  if (
    !/^[a-z][a-z0-9_.]{2,100}$/.test(type) ||
    !type.startsWith(provider + ".")
  )
    throw Error("Le type doit appartenir au fournisseur");
  const title = String(body.title || body.payload?.title || "");
  const text = String(
    body.content || body.message || body.payload?.message || title || type,
  ).slice(0, 8000);
  return {
    type,
    content:
      title && !text.startsWith(title)
        ? `${title.slice(0, 200)}\n${text}`.slice(0, 8000)
        : text,
    severity: String(body.severity || body.payload?.severity || "info").slice(
      0,
      30,
    ),
    payload: body.payload || {},
  };
}
