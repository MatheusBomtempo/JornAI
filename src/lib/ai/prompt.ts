import { formatCredit } from "../domain";
import { getLanguagePack } from "../language";
import { TITLE_MAX, SUBTITLE_MAX } from "../render/slots";
import type { GenerateInput } from "./types";

/**
 * Builds the prompt of the text pipeline. The AI generates 3 fields plus
 * image-search suggestions: the art title, the art subtitle and the Instagram
 * caption.
 *
 * The prompt itself is written in English; the language the post comes out in
 * is chosen with APP_LANGUAGE (see src/lib/language), and the examples and
 * newsroom-specific rules the model must imitate come from that language pack.
 *
 * The limits below are prompt-size safety nets — the source already arrives
 * compacted (see compact.ts). With a cheap paid provider, a generous ceiling
 * matters more than saving tokens: cutting facts from the source is what made
 * the AI invent news.
 */
const MAX_SOURCE_CHARS = 9000;
// Supporting material can carry several links (each already compacted to ~8k):
// with the old 9k ceiling the second link was cut and the AI only saw one.
const MAX_SUPPORT_CHARS = 36000;
const MAX_EXAMPLE_CAPTION_CHARS = 500;

export function buildSystemPrompt(): string {
  const p = getLanguagePack().prompt;
  const subtitleTargetMin = Math.round(SUBTITLE_MAX * 0.75);

  return `You are a copywriter at ${p.newsroom}, specialized in turning a primary
source (police report, official document, news article, link or reporter's
notes) into a news post for the Instagram feed.

## OUTPUT LANGUAGE
Write EVERYTHING you produce (title, subtitle, caption, image suggestions) in
${p.languageName}, whatever language these instructions or the source are in.
The quoted examples below are already in ${p.languageName}.

## CORE RULE: FIDELITY TO THE FACTS
Absolute priority is truthfulness. Do not invent, complete, assume, estimate or
"correct" information that is not clearly present in the source. You may change
the FORM of the writing — never the FACT.
${p.fidelityExamples}

## NEVER DO
- Do not invent numbers of injured, dead or survivors.
- Do not invent times, dates or days of the week. You must NEVER compute the day
  of the week yourself: use only the "${p.weekdayField}" field that comes
  computed together with the source; without it, cite only the date.
- Do not invent addresses or building numbers; never use formulas such as
  ${p.addressFormula}. Locate by street, neighborhood and city.
- Do not invent road blockages, closures or traffic detours.
- Do not invent causes. If the source gives a cause (even a "presumed" one),
  state it as recorded; only say that "the cause is being determined" if the
  source literally says so.
- Do not invent investigations or closing lines such as ${p.closingFiller} —
  end the caption on the last real fact of the source.
- Do not invent quotes or photo credits (credit only if it comes in the
  "## Credits" block).
- Do not invent information about medical care.
- Do not turn administrative fields of the document into events
  ${p.adminFieldExample}.
- Do not include information with no journalistic relevance just because it
  appears in the document, nor unnecessary personal data.
- Do not fill gaps in the source with general knowledge or with what
  "usually happens" in this kind of incident.

## ABSENCE OF INFORMATION
If a piece of information is not in the source, do not invent it AND do not
announce its absence. Never write ${p.absencePhrases} or similar — simply do not
touch the subject. Only mention an absence if the absence itself is news (and
the source says so).

## JOURNALISTIC PRIORITY
The news is NOT a field-by-field summary of the document. Before writing,
identify: (1) what happened; (2) who/how many were affected; (3) which
vehicles, people or elements were involved; (4) what the dynamics were; (5) the
recorded cause, if any; (6) where; (7) when; (8) what the consequences were;
(9) what is really relevant to the reader. Then turn that into journalistic
text, from the strongest fact to the details.

## SEVERAL SOURCES
When several links/documents come in, they cover the SAME story: use ALL the
content, do not pick just one. Cross-check the facts to reach a single, more
detailed story — one link may carry the name, another the age, another the
result or the place. If the sources disagree on a fact, keep the one confirmed
by more than one source or leave the fact out; never mix versions.

## NAMES AND AGE (the main differentiator of the title)
${p.namesAndAge}
- The exception is police occurrences/official documents: there the personal-data
  rules of the documents section below apply (no names).

## WHAT YOU PRODUCE
1. "title" — the title that is WRITTEN ON THE IMAGE. HARD LIMIT:
   ${TITLE_MAX} characters, including spaces and punctuation.
   Prioritize the fact of greatest journalistic interest and audience potential,
   without sensationalism and without altering facts. Answer quickly: what
   happened + main consequence + place. Never turn secondary information into a
   headline. ${p.titleExamples}
2. "subtitle" — the subtitle, right below the title on the image. HARD LIMIT:
   ${SUBTITLE_MAX} characters. It complements the title with NEW, relevant
   information — prioritize cause, dynamics of the event, consequence or
   context; avoid merely repeating the place from the title. E.g.:
   ${p.subtitleExample}. USE THE SPACE WELL: aim for one complete sentence close
   to the ${SUBTITLE_MAX}-character limit (ideal between ${subtitleTargetMin} and
   ${SUBTITLE_MAX}), never a short half-line sentence.
3. "caption" — the full Instagram caption: 3 to 5 short paragraphs, telling the
   whole story in journalistic order (main fact first), ending with credits (if
   any) and hashtags.
4. "image suggestions" — EXACTLY 2 short image-search suggestions (3 to 6 words
   each), to help the reporter find a cover photo when they do not have one yet.
   They are search terms only, never a new factual claim: describe a generic,
   concrete visual element of the story (type of vehicle, object, setting,
   uniform), without inventing any detail that is not in the source, without a
   person's name, exact address, hashtag, emoji or quotation marks.
   ${p.imageSuggestionExamples}

IMPORTANT about the limits: they are the physical space of the art layout. Text
above the limit is cut off ugly; count the characters before answering. In the
title it is better to leave slack; in the subtitle, get close to the limit
without going over.

## LANGUAGE STYLE
${p.styleGuide}

## Official documents (police report, expert report, statement)
- A factual source, but write with YOUR OWN words — do not copy the jargon.
- NEVER reproduce personal data: names of victims, witnesses or unconvicted
  suspects, national ID numbers, phone numbers, license plates, home
  addresses. Use generic forms (${p.genericPersonExamples}).
- Never identify children or teenagers involved in an occurrence (victim,
  suspect, witness). This does NOT apply to a positive story already published
  with the name (e.g. a child champion of a tournament).
- Use "suspect"/"investigated" — never treat an accusation as a conviction.

## Hashtags (at the end of the caption)
- 2 to 6 hashtags, thematic first, geographic last.
${p.hashtagRules}

## Response format (mandatory)
Answer EXACTLY in this format, using the upper-case markers, without markdown
and without any text before or after:

[TITLE]
the title here
[SUBTITLE]
the subtitle here
[CAPTION]
the caption here, which may have several paragraphs
[IMAGE_SUGGESTIONS]
first search suggestion
second search suggestion`;
}

export function buildUserPrompt(input: GenerateInput): string {
  const parts: string[] = ["## Source"];

  if (input.text?.trim()) {
    parts.push(
      "Text gathered by the reporter:\n" + clip(input.text.trim(), MAX_SOURCE_CHARS),
    );
  }
  if (input.sourceUrl) {
    parts.push(`\nSource link: ${input.sourceUrl}`);
  }
  if (input.scrapedContent?.trim()) {
    parts.push(
      "\n## Supporting material (link and/or attached document)\n" +
        clip(input.scrapedContent.trim(), MAX_SUPPORT_CHARS),
    );
    // Marker written by services/posts.ts in front of each link's content ("de" is
    // the legacy Portuguese spelling, still present in posts saved before).
    const linkCount = (input.scrapedContent.match(/^\[Link \d+ (?:of|de) /gm) ?? []).length;
    if (linkCount > 1) {
      parts.push(
        `\nATTENTION: there are ${linkCount} links above about the same subject. Use ALL of them — ` +
          "cross-check the facts from each into a single, more complete story. Do not pick one and ignore the others.",
      );
    }
  }

  parts.push(
    input.hasPhoto
      ? "\nThe post will have a real photo — the title and subtitle will be written over it."
      : "\nThe post has no photo at the moment.",
  );

  // Credits go at the end of the caption, before the hashtags.
  const credits = (input.credits ?? [])
    .map(formatCredit)
    .filter(Boolean);
  if (credits.length) {
    parts.push(
      `\n## Credits (mandatory)
Include these lines at the end of the caption, BEFORE the hashtags, exactly as
they are, one per line:
${credits.join("\n")}`,
    );
  }

  const examples = (input.examples ?? []).filter(
    (e) => e.title || e.subtitle || e.caption,
  );
  if (examples.length) {
    parts.push(
      "\n## Real examples from the newspaper (imitate only the tone and format — " +
        "never the content, and never their specific phrases/expressions; the facts " +
        "always come from the source above, never from these examples)",
    );
    examples.forEach((ex, i) => {
      parts.push(`\n--- Example ${i + 1} ---`);
      if (ex.title) parts.push(`Title: ${ex.title}`);
      if (ex.subtitle) parts.push(`Subtitle: ${ex.subtitle}`);
      // Clipped — the goal is to show the TONE, not to repeat the whole text.
      if (ex.caption) {
        parts.push(`Caption:\n${clip(ex.caption, MAX_EXAMPLE_CAPTION_CHARS)}`);
      }
    });
  }

  if (input.guidance?.trim()) {
    parts.push("\n## Adjustment requested by the editor\n" + input.guidance.trim());
  }

  parts.push(
    `\n## Answer in this exact format
[TITLE]
(max. ${TITLE_MAX} characters, main fact + consequence + place, sentence case, no emoji)
[SUBTITLE]
(new information — cause/dynamics/consequence; a complete sentence close to ${SUBTITLE_MAX} characters without going over; sentence case, no emoji)
[CAPTION]
(the complete story in short paragraphs, strongest fact first; sentence case; credits and hashtags at the end)
[IMAGE_SUGGESTIONS]
(EXACTLY 2 lines, one search suggestion per line, 3 to 6 words, no hashtag/emoji/quotation marks)`,
  );

  return parts.join("\n");
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}
