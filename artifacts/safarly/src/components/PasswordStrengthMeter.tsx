/**
 * Shared password-strength meter for /login (signup mode) and /reset-password.
 * Visual design (4-segment bar, colour ramp, Check/X rule list) is preserved
 * from the original inline implementation — this is a de-duplication + i18n
 * refactor, not a redesign.
 */
import { Check, X } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { PASSWORD_MIN_LENGTH, type PasswordAssessment, type PasswordRuleId } from "@/lib/validation";

/** Maps a rule id to its locale key. Exported so pages can translate
    `assessment.firstFailureId` for the form-level policy error without
    duplicating the id→key mapping. */
export const RULE_KEY: Record<PasswordRuleId, string> = {
  length: "password.rule.length",
  lower: "password.rule.lower",
  upper: "password.rule.upper",
  number: "password.rule.number",
  notPersonal: "password.rule.not_personal",
};

const STRENGTH_WORD: Record<1 | 2 | 3 | 4, string> = {
  1: "password.strength.weak",
  2: "password.strength.fair",
  3: "password.strength.good",
  4: "password.strength.strong",
};

interface PasswordStrengthMeterProps {
  assessment: PasswordAssessment;
  /** Hidden entirely until the user types — an all-red checklist on an empty
      field reads as failure before they've done anything. */
  visible: boolean;
  /** Ties the meter to its input for screen readers. */
  id?: string;
}

export function PasswordStrengthMeter({ assessment, visible, id }: PasswordStrengthMeterProps) {
  const { t } = useTranslation();
  if (!visible) return null;

  const { score } = assessment;
  const strengthWord = score >= 1 ? t(STRENGTH_WORD[score as 1 | 2 | 3 | 4]) : "";

  return (
    <div id={id} style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div
          role="meter"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={4}
          aria-label={t("password.strength.label").replace("{score}", String(score))}
          style={{ display: "flex", gap: 4, flex: 1 }}
        >
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                flex: 1, height: 4, borderRadius: 2,
                background: i < score
                  ? (score <= 1 ? "#DC2626"
                    : score === 2 ? "#F59E0B"
                    : score === 3 ? "#84CC16" : "var(--sf-accent)")
                  : "var(--sf-border)",
                transition: "background 200ms ease",
              }}
            />
          ))}
        </div>
        {strengthWord && (
          <span style={{ fontSize: "0.7rem", color: "var(--sf-text-muted)", flexShrink: 0 }}>
            {strengthWord}
          </span>
        )}
      </div>
      <ul style={{ display: "flex", flexDirection: "column", gap: 5, listStyle: "none", padding: 0, margin: 0 }}>
        {assessment.rules.map(rule => (
          <li
            key={rule.id}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              fontSize: "0.78rem",
              color: rule.passed ? "var(--sf-accent)" : "var(--sf-text-muted)",
            }}
          >
            {rule.passed
              ? <Check size={13} aria-hidden style={{ flexShrink: 0 }} />
              : <X size={13} aria-hidden style={{ flexShrink: 0, opacity: 0.5 }} />}
            <span>{t(RULE_KEY[rule.id]).replace("{min}", String(PASSWORD_MIN_LENGTH))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
