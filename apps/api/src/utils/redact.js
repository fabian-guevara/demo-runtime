const secretFieldPattern = /(secret|token|password|key|uri)/i;

export function redactValue(value) {
  if (!value || typeof value !== "string") {
    return value;
  }

  if (value.length <= 8) {
    return "[REDACTED]";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function redactSecretsInText(text, secrets = []) {
  if (typeof text !== "string" || text.length === 0) {
    return text;
  }

  let next = text;

  for (const secret of secrets) {
    if (!secret || typeof secret !== "string") {
      continue;
    }

    if (secret.length < 6) {
      continue;
    }

    next = next.split(secret).join(redactValue(secret));
  }

  return next.replace(
    /mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi,
    "[REDACTED_MONGODB_URI]"
  );
}

export function sanitizeObject(input) {
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeObject(item));
  }

  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => {
        if (typeof value === "string" && secretFieldPattern.test(key)) {
          return [key, redactValue(value)];
        }

        return [key, sanitizeObject(value)];
      })
    );
  }

  return input;
}
