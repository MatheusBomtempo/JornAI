import type { PromptPack } from "../types";

/**
 * The prompt is written in English; everything the model must reproduce in
 * the OUTPUT language (examples, quoted phrases, hashtags) lives here, in
 * Portuguese. Newsroom-specific rules (region, hashtags) are also kept here.
 */
export const prompt: PromptPack = {
  languageName: "Brazilian Portuguese",
  newsroom: "a newspaper newsroom in Minas Gerais, Brazil",
  weekdayField: "Dia da semana",

  fidelityExamples: `- If the source says "quatro passageiros sofreram ferimentos leves", you may NOT
  write "um homem ficou ferido", even if it sounds more natural.
- If the source says "problemas no sistema de frenagem", you may adapt it to
  "falha no sistema de freios" (same meaning), but NOT to "o freio quebrou
  completamente" (more specific than the source supports).`,

  addressFormula: `"na altura do número X"`,

  closingFiller: `"a perícia está apurando as circunstâncias" or "o caso segue sob investigação"`,

  absencePhrases: `"não foi informado", "não há informações sobre...", "a identidade não foi divulgada"`,

  adminFieldExample: `(e.g. "o acidente não envolveu transferência de valores por meio digital" is a
  system field of the police report, never a news sentence)`,

  namesAndAge: `- A person's name brings the story closer to the reader: if the source gives the
  name of the protagonist of a positive or neutral story (sports, contest, award,
  achievement, culture, tribute), USE the name in the title and the caption.
  E.g.: "Barbacenense Lucas, de 12 anos, é campeão de jiu-jitsu em Curitiba"
  is better than "Barbacenense é campeão de jiu-jitsu".
- Only use names that are WRITTEN in the source. If the source does not give the
  name, do not invent it, do not "complete" a surname and do not mention that it
  is missing — write without it.
- Age only goes in the title when the age itself is part of the story: a very
  young or very old person for the feat. Right: "Barbacenense de 16 anos vence
  olimpíada de matemática em Uberlândia" / "Barbacenense de 74 anos vence
  olimpíada de matemática em Uberlândia". Wrong: "Barbacenense de 30 anos vence
  olimpíada de matemática" — the age adds nothing there; it is enough to say the
  person is from Barbacena (the newspaper is from Barbacena, the origin is the
  hook). In the caption the age can appear normally, if it is in the source.`,

  titleExamples: `Right: "Acidente entre ônibus e carro deixa quatro feridos em Barbacena".
   Wrong: "Acidente de trânsito em Barbacena deixa um ferido" (wrong number) or
   "Acidente deixa condutor sem ferimentos" (a peripheral detail became the headline).`,

  subtitleExample: `"Ônibus apresentou problemas no sistema de frenagem e bateu em um poste após desviar de um carro"`,

  imageSuggestionExamples: `E.g.: source is about a stolen motorcycle → "moto estacionada
   rua"; source is about a weapon seizure → "arma sobre mesa"; source is about a
   military police car in Barbacena → "viatura polícia militar MG".`,

  styleGuide: `Write like a Brazilian news portal, in the style of local portals in Minas
Gerais: clear, objective, natural, direct, informative and attractive.
The title must generate interest because the FACT is interesting — never through
exaggeration, sensationalism or unproven information.
- Sentence case always (title, subtitle and caption): only the first letter of
  the sentence is capitalized — EXCEPT acronyms (BH, MG, PM, SAMU…), which stay
  in capitals. Never write in ALL CAPS, even if the source comes that way.
- EMOJI: none, or at most one in the caption (several only if the source is a
  list of recommendations). Title and subtitle NEVER carry an emoji.`,

  genericPersonExamples: `"um homem de 42 anos", "os passageiros do coletivo"`,

  hashtagRules: `- Barbacena or region: include #Barbacena and #MG (may add #MinasGerais).
- Belo Horizonte: #BH and the ones that widen reach (#BeloHorizonte, #MG).
- Another city in Minas Gerais: the city hashtag + #MG.
- No identified city: only the thematic ones.`,
};
