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
};
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
  ["The AI kept violating factual-fidelity rules even after correction", "A IA insistiu em violar regras de fidelidade factual mesmo após correção"],
  ["Action restricted to the roles:", "Ação restrita aos papéis:"],
];

const API_ERROR_PATTERNS_PT: [RegExp, string][] = [
  [/^Type (.+) to confirm\.$/, "Digite $1 pra confirmar."],
];

export function translateApiMessage(message: string, locale: Locale): string {
  if (locale !== "pt") return message;
  const exact = API_ERRORS_PT[message];
  if (exact) return exact;
  for (const [prefix, translated] of API_ERROR_PREFIXES_PT) {
    if (message.startsWith(prefix)) return translated + message.slice(prefix.length);
  }
  for (const [pattern, template] of API_ERROR_PATTERNS_PT) {
    if (pattern.test(message)) return message.replace(pattern, template);
  }
  return message;
}
