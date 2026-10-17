export async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  csrf: string | null = null,
): Promise<T> {
  let response: Response;
  const headers = new Headers(options.headers);
  if (options.method) {
    if (!headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");
    if (!headers.has("X-CSRF-Token")) headers.set("X-CSRF-Token", csrf ?? "");
  }
  try {
    response = await fetch(path, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(15000),
      headers,
    });
  } catch {
    throw new Error(
      "Chưa kết nối được dịch vụ. Hãy kiểm tra mạng rồi thử lại.",
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    if (response.status === 429)
      throw new Error(
        "Bạn đang thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.",
      );
    throw new Error("Dịch vụ đang bận. Vui lòng thử lại sau ít phút.");
  }
  if (!response.ok) {
    const error =
      data && typeof data === "object" && "error" in data ? data.error : null;
    throw new Error(
      typeof error === "string" ? error : "Có lỗi xảy ra. Vui lòng thử lại.",
    );
  }
  return data as T;
}
