export function canEditLink(
  link: { status: string; expires_at: number; fixed_expires_at: number | null },
  expiryHeld: boolean,
  now = Date.now(),
) {
  return (
    link.status === "active" &&
    (link.fixed_expires_at === null || link.fixed_expires_at > now) &&
    (expiryHeld || link.expires_at > now)
  );
}
