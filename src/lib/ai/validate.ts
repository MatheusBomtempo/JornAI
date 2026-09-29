import { getLanguagePack } from "../language";
import type { GeneratedContent } from "./types";

/**
 * Deterministic factual validation of the generated text against the source.
 * Zero AI: only rules that code can check with certainty — each one was born
 * from a REAL mistake the model made in production. The goal is not to judge
 * style but to block misinformation: wrong weekday, invented boilerplate
 * (blocked road, "under investigation"), absence phrases ("was not
 * disclosed"), exposed names of people involved, etc.
 *
 * The rules themselves (which phrases, in which language) come from the
 * language pack — see src/lib/language/<lang>/validate.ts.
 *
 * Usage (see index.ts): generate → validate → if it violated, regenerate ONCE
 * with the fixes as guidance → if a critical rule is still violated, fail
 * loudly (the post ends up FAILED) instead of delivering a story with an
 * invented fact.
 */

export interface Violation {
  rule: string;
  /** Correction instruction, ready to become guidance for the model. */
  fix: string;
}

function combinedOutput(content: GeneratedContent): string {
  return [content.title, content.subtitle, content.instagramCaption]
    .filter(Boolean)
    .join("\n");
}

export function validateGeneratedContent(
  content: GeneratedContent,
  sourceText: string,
): Violation[] {
  const pack = getLanguagePack();
  const output = combinedOutput(content);
  const source = sourceText ?? "";
  const violations: Violation[] = [];

  // 1) Weekday: if the text cites one, it must match some date in the source
  // (computed by code) or be written literally in the source.
  const validWeekdays = new Set(
    pack.findDates(source).map(({ date }) => pack.weekdays[date.getDay()].name),
  );
  const sourceLower = source.toLowerCase();
  for (const weekday of pack.weekdays) {
    if (!weekday.pattern.test(output)) continue;
    const supported =
      sourceLower.includes(weekday.sourceStem) || validWeekdays.has(weekday.name);
    if (!supported) {
      violations.push({
        rule: `weekday "${weekday.name}" not supported by the source`,
        fix: `Remove or correct the day of the week — the source does not support "${weekday.name}". Use only the "${pack.prompt.weekdayField}" field provided, or cite just the date.`,
      });
    }
  }

  // 2) Phrases that are forbidden under any circumstances.
  for (const f of pack.validation.alwaysForbidden) {
    if (f.pattern.test(output)) violations.push({ rule: f.rule, fix: f.fix });
  }

  // 3) Claims that need support in the source.
  for (const f of pack.validation.needsSourceSupport) {
    if (f.output.test(output) && !f.source.test(source)) {
      violations.push({ rule: f.rule, fix: f.fix });
    }
  }

  return violations;
}

/** Corrective guidance block for the second attempt. */
export function violationsToGuidance(violations: Violation[]): string {
  const fixes = [...new Set(violations.map((v) => v.fix))];
  return (
    "ATTENTION — your previous answer violated factual-fidelity rules. " +
    "Rewrite it fixing ALL the points below, without introducing new ones:\n- " +
    fixes.join("\n- ")
  );
}
