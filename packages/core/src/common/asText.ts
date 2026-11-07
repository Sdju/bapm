/** Safe stringification for unknown values (avoids '[object Object]'). */
export function asText(value: unknown, fallback = ""): string {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
    case "boolean":
    case "bigint":
      return String(value);
    case "undefined":
      return fallback;
    case "symbol":
      return value.description ?? fallback;
    case "object":
      if (value === null) return fallback;
      try {
        return JSON.stringify(value) ?? fallback;
      } catch {
        return fallback;
      }
    case "function":
      return fallback;
    default:
      return fallback;
  }
}
