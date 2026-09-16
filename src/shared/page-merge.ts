// src/shared/page-merge.ts
export type Block = {
  id?: string;
  type: string;
  content: string;
  checked?: boolean;
};
const canonical = (v: unknown) =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x).sort(([a], [b]) => a.localeCompare(b)),
        )
      : x,
  );
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
// Three-way merge: unrelated block edits survive; concurrent edits of one block conflict.
export function mergeBlocks(
  base: Block[],
  local: Block[],
  remote: Block[],
): Block[] | null {
  if ([...base, ...local, ...remote].some((b) => !b.id)) return null;
  if (
    [base, local, remote].some(
      (bs) => new Set(bs.map((b) => b.id)).size !== bs.length,
    )
  )
    return null;
  const before = new Map(base.map((b) => [b.id, b])),
    ours = new Map(local.map((b) => [b.id, b])),
    theirs = new Map(remote.map((b) => [b.id, b]));
  const merged = new Map(theirs);
  for (const id of new Set([...before.keys(), ...ours.keys()])) {
    const a = before.get(id),
      b = ours.get(id),
      c = theirs.get(id);
    if (same(a, b)) continue;
    if (!same(a, c) && !same(b, c)) return null;
    if (b) merged.set(id, b);
    else merged.delete(id);
  }
  const baseOrder = base.map((b) => b.id),
    localOrder = local.filter((b) => before.has(b.id)).map((b) => b.id),
    remoteOrder = remote.filter((b) => before.has(b.id)).map((b) => b.id);
  const localMoved = !same(
      baseOrder.filter((id) => ours.has(id)),
      localOrder,
    ),
    remoteMoved = !same(
      baseOrder.filter((id) => theirs.has(id)),
      remoteOrder,
    );
  if (localMoved && remoteMoved && !same(localOrder, remoteOrder)) return null;
  const order = localMoved ? local : remote;
  const result = order.flatMap((b) =>
    merged.has(b.id) ? [merged.get(b.id)!] : [],
  );
  for (const b of local)
    if (merged.has(b.id) && !result.some((r) => r.id === b.id))
      result.push(merged.get(b.id)!);
  return result;
}
