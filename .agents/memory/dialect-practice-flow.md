---
name: Dialect practice flow
description: How the Practice button and SpeechRecognition flow work in /dialect
---

# Dialect Practice Flow

## Rule
Practice uses `SpeechRecognition` (Web Speech API, lang `ar-SA`) to capture the user's attempt, not playback. Listen plays TTS. The two buttons must never share behaviour.

## Phases
`PracticePhase = "idle" | "playing" | "recording" | "result" | "done"`
- `recording` — mic is active, SpeechRecognition running
- `result` — recognition done; `resultMap[id].passed` determines pass/fail UI
- `listening` — fallback only when SpeechRecognition is unavailable (shows "I said it" + Skip)

## Comparison
`arabicMatch(transcript, expected)` strips tashkeel (U+064B–U+065F, U+0670), splits on whitespace, passes if ≥40% of expected words appear in transcript (word-level substring). Threshold is deliberately lenient.

## On pass
Auto-calls `handleConfirm(phraseId)` → phase jumps directly to `"done"` (marked learned). No extra confirmation step.

## On fail
Sets `resultMap[id] = { passed: false }`, phase → `"result"`. Shows transliteration as hint, offers Listen + Try again + Skip buttons.

## No-mic fallback
If `window.SpeechRecognition` and `window.webkitSpeechRecognition` are both absent, or `rec.onerror` fires, sets `micMissing[id]=true` and falls back to `"listening"` phase with the "I said it" / Skip UI.

**Why:** Prompt H required real mic recording, not reference audio replay. SR is Chrome/Edge only; graceful degradation was required.
