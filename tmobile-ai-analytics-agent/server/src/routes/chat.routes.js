import { Router } from "express";
import { handleChat } from "../services/agentService.js";

const router = Router();

router.post("/", async (req, res) => {
  const { conversationId, userId, message } = req.body ?? {};

  if (!message?.trim()) {
    res.status(400).json({
      error: "message is required."
    });
    return;
  }

  try {
    const result = await handleChat({
      conversationId,
      userId,
      message
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

export default router;
