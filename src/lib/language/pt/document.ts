import type { DocumentPack } from "../types";
import { cleanFormDocument, looksLikeFormDocument } from "./police-form";

export const document: DocumentPack = {
  structuredSignals: [
    /boletim de ocorr[êe]ncia/i,
    /\bnatureza\s*[:\-]/i,
    /\bdata (?:do fato|da ocorr[êe]ncia|do registro)\s*[:\-]/i,
    /\blocal(?: do fato| da ocorr[êe]ncia)?\s*[:\-]/i,
    /\benvolvidos?\s*[:\-]/i,
    /\bv[íi]tima(?:s)?\s*[:\-]/i,
    /\bcomunicante\s*[:\-]/i,
    /\brelato\s*[:\-]?/i,
    /\bhist[óo]rico\s*[:\-]?/i,
    /\bn[º°]\s*(?:de\s*)?(?:registro|ocorr[êe]ncia|bo)\b/i,
    /\blaudo (?:pericial|m[ée]dico)/i,
    /\bnota (?:oficial|[àa] imprensa)/i,
  ],
  narrativeInline:
    /^\s*(?:relato|hist[óo]rico|descri[çc][ãa]o dos fatos)\s*[:\-]\s*(.+)$/i,
  narrativeHeader: /^##\s*(?:relato|hist[óo]rico|descri[çc][ãa]o dos fatos)\b/i,
  docTypeHeader:
    /(boletim de ocorr[êe]ncia|laudo pericial|nota (?:oficial|[àa] imprensa))/i,
  // "data do fato" / "da ocorrência" / "do registro" → just "data".
  labelNoise: /\b(do fato|da ocorrencia|do registro)\b/g,
  fieldLabels: { type: "Tipo de documento", narrative: "Relato" },
  form: {
    looksLikeForm: looksLikeFormDocument,
    clean: cleanFormDocument,
  },
};
