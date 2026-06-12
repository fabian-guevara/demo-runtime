export function redactValue(value) {
  if (!value || typeof value !== "string") {
    return value;
  }

  if (value.length <= 8) {
    return "[REDACTED]";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function redactText(text, secrets = []) {
  if (typeof text !== "string" || text.length === 0) {
    return text;
  }

  let next = text.replace(
    /mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi,
    "[REDACTED_MONGODB_URI]"
  );

  for (const secret of secrets) {
    if (!secret || typeof secret !== "string" || secret.length < 6) {
      continue;
    }

    next = next.split(secret).join(redactValue(secret));
  }

  return next;
}

export function sanitizeObject(input) {
  if (input instanceof Date) {
    return input.toISOString();
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeObject(item));
  }

  if (input && typeof input === "object") {
    if (typeof input.toHexString === "function") {
      return input.toHexString();
    }

    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => {
        if (/secret|token|key|uri|password/i.test(key) && typeof value === "string") {
          return [key, redactValue(value)];
        }

        return [key, sanitizeObject(value)];
      })
    );
  }

  return input;
}
