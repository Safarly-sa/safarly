/**
 * POST /api/dialect/evaluate and /api/dialect/dialogue — the Dialect & Language
 * Coach's two surfaces.
 *
 * Plain JSON, not SSE: unlike trip generation (three concurrent agents) and the
 * concierge (an incrementally-arriving reply), both of these are one short
 * round-trip whose result is only useful complete. Streaming a two-sentence
 * correction would be ceremony without benefit.
 *
 * Evaluation deliberately does NOT own the pass/fail decision — dialect.tsx's
 * offline arabicMatch() already does that instantly and for free. This route
 * exists to add the coaching text that a word-overlap check cannot produce, so
 * a failure here costs the learner nothing but the tip.
 */
import { Router, type IRouter } from "express";
import { requireSession } from "../../lib/session";
import { enforceQuotaUnlessDemo } from "../../lib/agent-quota";
import { isDemoMode } from "../../lib/agent-mode";
import { logger } from "../../lib/logger";
import { runDialectEvaluate, runDialectDialogue } from "./dialect-agent";
import { validateEvaluateRequest, validateDialogueRequest } from "./dialect-validate";

const router: IRouter = Router();

router.post("/dialect/evaluate", requireSession, enforceQuotaUnlessDemo, async (req, res) => {
  const parsed = validateEvaluateRequest(req.body);
  if (!parsed) {
    res.status(400).json({ error: "Invalid dialect/evaluate request body." });
    return;
  }

  // runDialectEvaluate already swallows model failures and returns a neutral,
  // encouraging result rather than throwing — see its own error branch.
  const result = await runDialectEvaluate(parsed, isDemoMode());
  res.json({ result });
});

router.post("/dialect/dialogue", requireSession, enforceQuotaUnlessDemo, async (req, res) => {
  const parsed = validateDialogueRequest(req.body);
  if (!parsed) {
    res.status(400).json({ error: "Invalid dialect/dialogue request body." });
    return;
  }

  try {
    const result = await runDialectDialogue(parsed, isDemoMode());
    res.json({ result });
  } catch (err) {
    // Unlike evaluate, the dialogue agent has no meaningful neutral fallback —
    // a made-up conversation would be worse than none.
    logger.error({ err }, "Dialect dialogue failed");
    res.status(502).json({ error: "The dialect coach couldn't produce a dialogue." });
  }
});

export default router;
