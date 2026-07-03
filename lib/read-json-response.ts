export async function readJsonResponse<T extends Record<string, unknown> = Record<string, unknown>>(
  res: Response
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (res.status === 504 || res.status === 502 || res.status === 408) {
      throw new Error(
        "Request timed out. Skill generation can take up to two minutes. Try again, or generate the evidence spec separately first."
      );
    }
    throw new Error(`Empty response from server (${res.status})`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      res.ok
        ? "Invalid JSON response from server"
        : `Server error (${res.status}): ${text.slice(0, 200)}`
    );
  }
}