import type { Language } from "./../language/types";
import type { Locale } from "./config";

/**
 * Texts that are produced on the server, outside React: transactional emails
 * and the messages of API errors. Client-facing UI copy lives in
 * ./dictionaries; the code itself only ever holds English.
 */

/** Login email, in the deployment language (APP_LANGUAGE). */
export const emailMessages: Record<
  Language,
  {
    subject: string;
    greeting: (name: string) => string;
    intro: string;
    emailLabel: string;
    passwordLabel: string;
    signIn: string;
    temporaryNotice: string;
    unexpectedNotice: string;
  }
> = {
  pt: {
    subject: "Seu acesso ao JornAI",
    greeting: (name) => `Olá, ${name}.`,
    intro: "Seu acesso ao JornAI foi (re)definido. Use os dados abaixo para entrar:",
    emailLabel: "E-mail",
    passwordLabel: "Senha",
    signIn: "Entrar no JornAI",
    temporaryNotice:
      "Essa senha é temporária. Depois de entrar, o app sugere cadastrar uma senha sua.",
    unexpectedNotice:
      "Se você não esperava este e-mail, avise quem administra o JornAI na sua redação.",
  },
  en: {
    subject: "Your JornAI access",
    greeting: (name) => `Hello, ${name}.`,
    intro: "Your JornAI access was (re)set. Use the details below to sign in:",
    emailLabel: "Email",
    passwordLabel: "Password",
    signIn: "Sign in to JornAI",
    temporaryNotice:
      "This password is temporary. After signing in, the app suggests setting a password of your own.",
    unexpectedNotice:
      "If you were not expecting this email, let whoever administers JornAI in your newsroom know.",
  },
};

/**
 * Placeholder content for a story sent as exactly "teste"/"test" (see
 * isTestSubmission in services/posts.ts): fills the post without calling the
 * AI, so the flow (art, review) can be tried without spending tokens and
 * without the model inventing a story out of one word.
 */
export const testPostContent: Record<
  Language,
  { title: string; subtitle: string; instagramCaption: string }
> = {
  pt: {
    title: "Título de exemplo para conferir a arte",
    subtitle: "Subtítulo de exemplo, com o tamanho de uma linha de apoio de verdade",
    instagramCaption:
      "Legenda de exemplo para conferir o fluxo de publicação.\n\nEste parágrafo ocupa o lugar do texto da notícia e pode ser editado à vontade antes de publicar.",
  },
  en: {
    title: "Sample title to check the art",
    subtitle: "Sample subtitle, about as long as a real supporting line",
    instagramCaption:
      "Sample caption to check the publishing flow.\n\nThis paragraph stands in for the story text and can be edited freely before publishing.",
  },
};

/**
 * API error messages are written in English in the code. For a Portuguese
 * interface they are translated here, by exact text, by prefix (messages
 * that end in a dynamic detail) or by pattern. Anything not listed stays in English.
 */
const API_ERRORS_PT: Record<string, string> = {
  "Not authenticated": "Não autenticado",
  "Permission denied": "Sem permissão",
  "Not found": "Não encontrado",
  "Invalid data": "Dados inválidos",
  "Internal server error": "Erro interno do servidor",
  "Invalid email or password.": "E-mail ou senha inválidos.",
  "Too many sign-in attempts. Try again in a few minutes.":
    "Muitas tentativas de login. Tente de novo em alguns minutos.",
  "Register your company before continuing.": "Cadastre sua empresa antes de continuar.",
  "You already have a company registered.": "Você já tem uma empresa cadastrada.",
  "API key not found.": "Chave não encontrada.",
  "Post not found.": "Post não encontrado.",
  "Post has no versions.": "Post sem versões.",
  "Version not found.": "Versão não encontrada.",
  "User not found.": "Usuário não encontrado.",
  "Example not found.": "Exemplo não encontrado.",
  "Font weight not available.": "Peso de fonte indisponível.",
  "Missing 'file' field.": "Campo 'file' ausente.",
  "Missing 'q' parameter.": "Parâmetro 'q' ausente.",
  "The file is larger than 20 MB.": "O arquivo passa de 20 MB.",
  "File larger than 100 MB.": "Arquivo maior que 100 MB.",
  "File larger than 15 MB.": "Arquivo maior que 15 MB.",
  "Unsupported format. Send a PDF (or .txt).": "Formato não suportado. Envie um PDF (ou .txt).",
  "Unsupported format (use MP4, MOV or WebM).": "Formato não suportado (use MP4, MOV ou WebM).",
  "Unsupported format (use JPEG, PNG or WebP).": "Formato não suportado (use JPEG, PNG ou WebP).",
  "The Pexels link did not return an image.": "O link do Pexels não retornou uma imagem.",
  "The Pexels image is larger than expected.": "Imagem do Pexels maior do que o esperado.",
  "Invalid image URL.": "URL de imagem inválida.",
  "Only images from images.pexels.com can be imported.": "Só é permitido importar imagens de images.pexels.com.",
  "Photo search is not configured (set PEXELS_API_KEY).": "Busca de fotos não configurada (defina PEXELS_API_KEY).",
  "You cannot edit this post.": "Você não pode editar este post.",
  "You cannot review this post.": "Você não pode revisar este post.",
  "You cannot reject this post.": "Você não pode recusar este post.",
  "You are not allowed to redo this.": "Sem permissão para refazer.",
  "You are not allowed to edit this.": "Sem permissão para editar.",
  "You already approved this version.": "Você já aprovou esta versão.",
  "You can only delete stories you created yourself.": "Você só pode apagar pautas que você mesmo criou.",
  "Invalid photo.": "Foto inválida.",
  "Invalid video.": "Vídeo inválido.",
  "Invalid template.": "Template inválido.",
  "The art/video has not been rendered for this version yet.": "A arte/vídeo ainda não foi renderizado para esta versão.",
  "A manager can only create manager or reporter accounts.": "Gerente só pode criar contas de gerente ou jornalista.",
  "A manager cannot promote anyone to admin.": "Gerente não pode promover ninguém a admin.",
  "A user with this email already exists.": "Já existe um usuário com esse e-mail.",
  "A manager cannot change an admin's account.": "Gerente não pode alterar a conta de um admin.",
  "You cannot deactivate or change the role of your own account.":
    "Você não pode desativar nem mudar o papel da sua própria conta.",
  "This post has already been published.": "Este post já foi publicado.",
  "This post is already being published.": "Este post já está sendo publicado.",
  "Upload the file through JornAI before using it.": "Envie o arquivo pelo JornAI antes de usá-lo.",
  "This link points to an address that cannot be accessed.": "Este link aponta para um endereço que não pode ser acessado.",
  "Invalid link.": "Link inválido.",
  "Only http and https links are supported.": "Só links http e https são aceitos.",
  "Could not find the site of this link.": "Não foi possível encontrar o site deste link.",
  "The site took too long to answer.": "O site demorou demais para responder.",
  "The page is too large to read.": "A página é grande demais para ser lida.",
  "Too many redirects.": "Redirecionamentos demais.",
  "The password must be at least 8 characters long.": "A senha precisa ter ao menos 8 caracteres.",
  "Send the text of the story, a link or a document.": "Envie o texto da notícia, um link ou um documento.",
  "Provide at least one field to edit.": "Informe ao menos um campo para editar.",
  "Use a color in the #rrggbb format.": "Use uma cor no formato #rrggbb.",
  "Could not read the PDF (corrupted or password-protected file).": "Não foi possível ler o PDF (arquivo corrompido ou protegido por senha).",
  "The PDF has no selectable text — it is probably a scanned document (image). Copy the text manually.": "O PDF não tem texto selecionável — provavelmente é um documento escaneado (imagem). Copie o texto manualmente.",
  "The file is empty.": "O arquivo está vazio.",
  "Could not extract text from the link (empty or protected page).": "Não foi possível extrair texto do link (página vazia ou protegida).",
  "The uploaded file has no video track.": "O arquivo enviado não tem faixa de vídeo.",
  "The AI answer is incomplete (the title or the caption is missing). Try generating again.": "Resposta da IA incompleta (faltou o título ou a legenda). Tente gerar de novo.",
  "No AI provider configured (check the API keys in .env).": "Nenhum provedor de IA configurado (verifique as chaves de API no .env).",
  "Instagram is not configured: set IG_USER_ID and IG_ACCESS_TOKEN.": "Instagram não configurado: defina IG_USER_ID e IG_ACCESS_TOKEN.",
  "The text is too short to write a story. Send at least one sentence about what happened, a link or a document.":
    "O texto está curto demais para virar notícia. Envie pelo menos uma frase sobre o que aconteceu, um link ou um documento.",
  "This story has no source text for the AI to rewrite. Edit the text by hand.":
    "Esta pauta não tem texto de origem para a IA reescrever. Edite o texto à mão.",
  "The same photo appears twice in the carousel.": "A mesma foto aparece duas vezes no carrossel.",
  "Invalid carousel photo.": "Foto do carrossel inválida.",
  "A carousel needs at least 2 images.": "Um carrossel precisa de pelo menos 2 imagens.",
};

/**
 * The factual-fidelity rules (lib/language/{pt,en}/validate.ts) explained in
 * plain words — whoever reads this error is a reporter, not a developer, so
 * each item says what the AI wrote that is not in their text.
 */
const RULES_PT: Record<string, string> = {
  'address formula "na altura de..."': 'usou a expressão "na altura de..." para indicar o local',
  'address formula "at the height of..."': 'usou a expressão "na altura de..." para indicar o local',
  'absence phrase ("não foi informado/divulgado")': 'escreveu que alguma informação "não foi divulgada", o que não acrescenta nada à notícia',
  'absence phrase ("não há informações")': 'escreveu que "não há informações" sobre algo, o que não acrescenta nada à notícia',
  'absence phrase ("was not disclosed/reported")': 'escreveu que alguma informação "não foi divulgada", o que não acrescenta nada à notícia',
  'absence phrase ("no information is available")': 'escreveu que "não há informações" sobre algo, o que não acrescenta nada à notícia',
  'person named ("identificado como...")': 'colocou o nome de uma pessoa envolvida ("identificado como..."), o que não deve ir para o post',
  'person named ("identified as...")': 'colocou o nome de uma pessoa envolvida ("identificado como..."), o que não deve ir para o post',
  "administrative report field turned into a sentence": "transformou um campo técnico do boletim de ocorrência em frase da notícia",
  "invented image credit": "inventou um crédito de foto que você não informou",
  "invented investigation": "disse que o caso está sendo investigado, mas o seu texto não fala disso",
  "invented road interdiction": "disse que a via foi interditada, mas o seu texto não fala disso",
  "invented road blockage": "disse que a via foi bloqueada, mas o seu texto não fala disso",
  "invented road closure": "disse que a via foi interditada, mas o seu texto não fala disso",
  "invented traffic detour": "falou em desvio no trânsito, mas o seu texto não fala disso",
  "invented death": "falou em morte, mas o seu texto não fala disso",
  'invented closing line "apurar as circunstâncias"': 'terminou com "a polícia vai apurar as circunstâncias", que não está no seu texto',
  'invented closing line about "the circumstances"': 'terminou com "a polícia vai apurar as circunstâncias", que não está no seu texto',
  "invented forensic examination": "falou em perícia, mas o seu texto não fala disso",
};

function explainRule(rule: string): string {
  const weekday = rule.match(/^weekday "(.+)" not supported by the source$/);
  if (weekday) {
    return `escreveu "${weekday[1]}", mas esse dia da semana não aparece no seu texto`;
  }
  return RULES_PT[rule] ?? rule;
}

const FIDELITY_RE =
  /^(?:(AI pipeline failed|AI rewrite failed): )?The AI kept violating factual-fidelity rules even after correction \((.+)\)\. Nothing was saved — try generating again or adjust the source\.$/s;

/**
 * The AI wrote something that is not in the reporter's text, twice in a row.
 * The technical wrapper ("AI pipeline failed: …") is dropped: the reporter
 * only needs what happened, that nothing was lost, and what to do next.
 */
function friendlyFidelityError(rules: string, isRewrite: boolean): string {
  const reasons = rules.split("; ").map(explainRule);
  const what =
    reasons.length === 1
      ? `A IA ${reasons[0]}.`
      : `A IA escreveu coisas que não estão no seu texto:\n${reasons.map((r) => `• ${r[0].toUpperCase()}${r.slice(1)};`).join("\n")}`;
  return (
    `${what}\n\n` +
    (isRewrite
      ? "Para não publicar uma informação errada, o texto novo foi descartado — o post continua como estava.\n\n"
      : "Para não publicar uma informação errada, esse texto foi descartado.\n\n") +
    (isRewrite
      ? "O que fazer: clique em “Tentar de novo” ou, se preferir, edite o texto à mão."
      : "O que fazer: clique em “Tentar de novo”. Se essa informação for verdadeira, " +
        "escreva ela no seu texto antes de enviar — assim a IA pode usá-la.")
  );
}
const API_ERROR_PREFIXES_PT: [string, string][] = [
  ["Could not download the photo from Pexels", "Não foi possível baixar a foto do Pexels"],
  ["Pexels refused the download", "Pexels recusou o download"],
  ["Pexels refused the search", "Pexels recusou a busca"],
  ["Pexels did not answer", "Pexels não respondeu"],
  ["OpenRouter did not answer", "OpenRouter não respondeu"],
  ["OpenRouter refused the balance query:", "OpenRouter recusou a consulta de saldo:"],
  ["Failed to send the email:", "Falha ao enviar e-mail:"],
  ["Failed to publish:", "Falha ao publicar:"],
  ["AI pipeline failed:", "Falha no pipeline de IA:"],
  ["AI rewrite failed:", "Falha ao reescrever com IA:"],
  ["Could not access the link", "Não foi possível acessar o link"],
  ["All AI providers failed. Attempts:", "Todos os provedores de IA falharam. Tentativas:"],
  ["The AI answered in an unexpected format. Start of the answer:", "A IA respondeu num formato inesperado. Início da resposta:"],
  ["Error trying to publish the media on Instagram:", "Erro ao publicar a mídia no Instagram:"],
  ["Error trying to create the media container on Instagram:", "Erro ao criar a mídia no Instagram:"],
  ["Error trying to create a carousel item on Instagram:", "Erro ao criar um item do carrossel no Instagram:"],
  ["Error trying to create the carousel container on Instagram:", "Erro ao criar o carrossel no Instagram:"],
  ["Error trying to create the video container on Instagram:", "Erro ao criar o vídeo no Instagram:"],
  ["Action restricted to the roles:", "Ação restrita aos papéis:"],
];

const API_ERROR_PATTERNS_PT: [RegExp, string | ((...groups: string[]) => string)][] = [
  [/^Type (.+) to confirm\.$/, "Digite $1 pra confirmar."],
  // Errors of one AI provider: "<provider>: <reason>".
  [/^([\w:./-]+): timed out \(the model took too long to answer\)\.$/, "$1: tempo esgotado (o modelo demorou demais para responder)."],
  [/^([\w:./-]+): connection failed \((.*)\)\.$/s, "$1: falha de conexão ($2)."],
  [/^([\w:./-]+): response has no text content\.$/, "$1: a resposta veio sem texto."],
  [/^Timed out waiting for Instagram to process (the image|the video)\.$/, (what) =>
    `Tempo esgotado esperando o Instagram processar ${what === "the video" ? "o vídeo" : "a imagem"}.`],
];

/**
 * Translates an API error. Wrapped messages ("AI pipeline failed: <inner>",
 * "All AI providers failed. Attempts:\n<provider>: <inner>") are translated
 * all the way down — before, only the outer prefix came out in Portuguese and
 * the actual reason stayed in English.
 */
export function translateApiMessage(message: string, locale: Locale): string {
  if (locale !== "pt") return message;
  const exact = API_ERRORS_PT[message];
  if (exact) return exact;
  const fidelity = message.match(FIDELITY_RE);
  if (fidelity) return friendlyFidelityError(fidelity[2], fidelity[1] === "AI rewrite failed");
  for (const [prefix, translated] of API_ERROR_PREFIXES_PT) {
    if (message.startsWith(prefix)) {
      const rest = message.slice(prefix.length);
      const lead = rest.match(/^\s*/)?.[0] ?? "";
      const inner = rest
        .slice(lead.length)
        .split("\n")
        .map((line) => translateLine(line, locale))
        .join("\n");
      return translated + lead + inner;
    }
  }
  return translateLine(message, locale, true);
}

/** One line: whole message, a pattern, or "<provider>: <message>". */
function translateLine(line: string, locale: Locale, topLevel = false): string {
  if (!topLevel) {
    const viaTop = API_ERRORS_PT[line];
    if (viaTop) return viaTop;
    if (API_ERROR_PREFIXES_PT.some(([p]) => line.startsWith(p))) return translateApiMessage(line, locale);
  }
  for (const [pattern, template] of API_ERROR_PATTERNS_PT) {
    const m = line.match(pattern);
    if (m) {
      return typeof template === "string"
        ? line.replace(pattern, template)
        : template(...m.slice(1));
    }
  }
  // "groq: <some known message>" inside the chain's list of attempts.
  const provider = line.match(/^([\w:./-]+): (.+)$/s);
  if (provider && !topLevel) {
    const inner = translateLine(provider[2], locale);
    if (inner !== provider[2]) return `${provider[1]}: ${inner}`;
  }
  return line;
}
