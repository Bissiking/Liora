// src/client/api.ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T = unknown>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      response.status,
      data.error?.code || "ERROR",
      data.error?.message || "Erreur de connexion.",
    );
  return data as T;
}

export async function collection(
  path: string,
): Promise<import("./types").Result> {
  let rows: import("./types").Row[] = [];
  let cursor: string | null | undefined;
  let permissions: string[] | undefined;
  do {
    const r = await api<import("./types").Result>(
      `${path}${cursor ? `${path.includes("?") ? "&" : "?"}after=${cursor}` : ""}`,
    );
    rows = rows.concat(r.data);
    permissions = r.permissions || permissions;
    cursor = r.nextCursor;
  } while (cursor);
  if (rows.some((r) => typeof r.position === "number"))
    rows.sort((a, b) => (a.position || 0) - (b.position || 0));
  return { data: rows, permissions };
}
export async function fileData(file: File) {
  if (file.size > 1_000_000)
    throw Error("Le fichier doit faire moins de 1 Mo.");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
