import { Router } from "express";
import { testGrovePrompt } from "../services/groveClient.js";
import { testEmbedding } from "../services/voyageClient.js";

const router = Router();

router.post("/llm/test", async (req, res) => {
  const prompt = req.body?.prompt?.trim();

  if (!prompt) {
    res.status(400).json({
      error: "A prompt is required."
    });
    return;
  }

  try {
    const result = await testGrovePrompt(prompt);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

router.post("/embeddings/test", async (req, res) => {
  const text = req.body?.text?.trim();

  if (!text) {
    res.status(400).json({
      error: "Text is required."
    });
    return;
  }

  try {
    const result = await testEmbedding(text);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

export default router;
