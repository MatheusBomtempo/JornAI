import type { DocumentPack } from "../types";

export const document: DocumentPack = {
  structuredSignals: [
    /\b(?:police|incident|arrest|accident|crash|offense|offence) report\b/i,
    /\bnature of (?:the )?(?:incident|offense|offence|call)\s*[:\-]/i,
    /\bdate (?:of (?:the )?(?:incident|occurrence|report)|reported)\s*[:\-]/i,
    /\blocation(?: of (?:the )?incident)?\s*[:\-]/i,
    /\b(?:persons?|parties|people) involved\s*[:\-]/i,
    /\bvictims?\s*[:\-]/i,
    /\bcomplainant\s*[:\-]/i,
    /\bnarrative\s*[:\-]?/i,
    /\b(?:report|case|incident) (?:no\.?|number|#)\s*[:\-]?\s*\S/i,
    /\bmedical examiner(?:'s)? report\b/i,
    /\b(?:press release|official statement)\b/i,
  ],
  narrativeInline:
    /^\s*(?:narrative|synopsis|summary of (?:the )?(?:facts|incident)|description of (?:the )?(?:incident|events))\s*[:\-]\s*(.+)$/i,
  narrativeHeader:
    /^##\s*(?:narrative|synopsis|summary of (?:the )?(?:facts|incident)|description of (?:the )?(?:incident|events))\b/i,
  docTypeHeader:
    /((?:police|incident|arrest|accident|crash) report|medical examiner(?:'s)? report|press release|official statement)/i,
  // "date of incident" / "date of report" → just "date".
  labelNoise: /\b(of (?:the )?(?:incident|occurrence|report))\b/g,
  fieldLabels: { type: "Document type", narrative: "Narrative" },
  // No official-form cleaning profile for English-language sources (yet).
  form: null,
};
