import type { PromptPack } from "../types";

/** Prompt pieces for English-language newsrooms. */
export const prompt: PromptPack = {
  languageName: "English",
  newsroom: "a local newspaper newsroom",
  weekdayField: "Day of the week",

  fidelityExamples: `- If the source says "four passengers suffered minor injuries", you may NOT
  write "a man was injured", even if it sounds more natural.
- If the source says "problems with the braking system", you may adapt it to
  "brake system failure" (same meaning), but NOT to "the brakes failed
  completely" (more specific than the source supports).`,

  addressFormula: `"at the height of number X"`,

  closingFiller: `"authorities are looking into the circumstances" or "the case remains under investigation"`,

  absencePhrases: `"it was not disclosed", "no information is available about...", "the person's identity was not released"`,

  adminFieldExample: `(e.g. "no digital funds transfer was involved" is a system field of the
  police report, never a news sentence)`,

  namesAndAge: `- A person's name brings the story closer to the reader: if the source gives the
  name of the protagonist of a positive or neutral story (sports, contest, award,
  achievement, culture, tribute), USE the name in the title and the caption.
  E.g.: "Riverton's Lucas Ortiz, 12, wins jiu-jitsu title in Denver" is better
  than "Riverton boy wins jiu-jitsu title".
- Only use names that are WRITTEN in the source. If the source does not give the
  name, do not invent it, do not "complete" a surname and do not mention that it
  is missing — write without it.
- Age only goes in the title when the age itself is part of the story: a very
  young or very old person for the feat. Right: "Riverton teen, 16, wins state
  math olympiad" / "Riverton woman, 74, wins state math olympiad". Wrong:
  "Riverton man, 30, wins math olympiad" — the age adds nothing there; it is
  enough to say the person is from Riverton (the origin is the hook). In the
  caption the age can appear normally, if it is in the source.`,

  titleExamples: `Right: "Bus and car collision leaves four injured in Riverton".
   Wrong: "Traffic accident in Riverton leaves one injured" (wrong number) or
   "Crash leaves driver unhurt" (a peripheral detail became the headline).`,

  subtitleExample: `"The bus had brake problems and hit a pole after swerving to avoid a car"`,

  imageSuggestionExamples: `E.g.: source is about a stolen motorcycle → "motorcycle parked
   street"; source is about a weapon seizure → "gun on table"; source is about a
   police car in Riverton → "police car patrol".`,

  styleGuide: `Write like a local English-language news site: clear, objective, natural,
direct, informative and attractive.
The title must generate interest because the FACT is interesting — never through
exaggeration, sensationalism or unproven information.
- Sentence case always (title, subtitle and caption): only the first letter of
  the sentence and proper nouns are capitalized — never Title Case, and never
  ALL CAPS, even if the source comes that way. Acronyms (PD, EMS, FBI…) stay in
  capitals.
- EMOJI: none, or at most one in the caption (several only if the source is a
  list of recommendations). Title and subtitle NEVER carry an emoji.`,

  genericPersonExamples: `"a 42-year-old man", "the bus passengers"`,

  hashtagRules: `- Use the city hashtag when a city is identified (e.g. #Riverton), plus the
  state or region hashtag.
- Prefer hashtags people actually search for; skip long or made-up ones.
- No identified city: only the thematic ones.`,
};
