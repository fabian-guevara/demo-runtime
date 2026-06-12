import { getMissingEnvVars } from "./credentialManager.js";
import { testGrovePrompt } from "./groveClient.js";
import logger from "../utils/logger.js";

function credentialKeysForGrove(demo) {
  return (demo.requiredEnv ?? []).filter(
    (key) => key.startsWith("GROVE_") || key === "API_KEY"
  );
}

export async function validateDemoBeforeStart(demo) {
  logger.info("Demo preflight starting", {
    demoId: demo.id,
    demoName: demo.name,
    requiredEnv: demo.requiredEnv
  });

  const missingEnv = await getMissingEnvVars(demo.requiredEnv);

  if (missingEnv.length > 0) {
    logger.warn("Demo preflight blocked by missing credentials", {
      demoId: demo.id,
      missingEnv
    });

    const error = new Error(`Missing required credentials: ${missingEnv.join(", ")}`);
    error.code = "DEMO_CONFIG_MISSING";
    error.credentialKeys = missingEnv;
    throw error;
  }

  const needsGrovePreflight = demo.requiredEnv?.includes("GROVE_API_KEY");

  if (needsGrovePreflight) {
    try {
      await testGrovePrompt("Reply with OK only.");

      logger.info("Demo preflight succeeded", {
        demoId: demo.id
      });
    } catch (cause) {
      logger.error("Demo preflight failed", {
        demoId: demo.id,
        demoName: demo.name,
        error: {
          name: cause?.name ?? null,
          code: cause?.code ?? null,
          message: cause?.message ?? null
        }
      });

      const error = new Error(`Grove preflight failed: ${cause.message}`);
      error.code = "DEMO_PREFLIGHT_FAILED";
      error.credentialKeys = credentialKeysForGrove(demo);
      error.cause = cause;
      throw error;
    }
  }

  return {
    ok: true
  };
}
