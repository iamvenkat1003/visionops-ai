const base = (import.meta.env.VITE_API_URL as string | undefined) || "";
export const token = () => sessionStorage.getItem("visionops-token");

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token()) headers.set("Authorization", `Bearer ${token()}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      headers,
      signal: options.signal || AbortSignal.timeout(90000),
    });
    if (!response.ok) {
      if (response.status === 401 && !path.includes("/auth/login"))
        window.dispatchEvent(new Event("session-expired"));
      const body = await response.json().catch(() => ({}));
      throw new Error(
        typeof body.detail === "string"
          ? body.detail
          : "Something went wrong. Please try again.",
      );
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof TypeError)
      throw new Error(
        "Cannot reach VisionOps. Check that the backend is running, then try again.",
      );
    if (
      error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    )
      throw new Error("The request timed out. Please try again.");
    throw error;
  }
}

export async function imageBlob(path: string, signal?: AbortSignal) {
  const headers: HeadersInit = token()
    ? { Authorization: `Bearer ${token()}` }
    : {};
  const response = await fetch(`${base}${path}`, {
    headers,
    signal: signal || AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("Image unavailable");
  return response.blob();
}
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Please try again.";
