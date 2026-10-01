export const about = {
  pt: {
    metaTitle: "Como funciona — JornAI",
    metaDescription: "Guia rápido do JornAI: da fonte ao post no Instagram em 4 passos.",
    signIn: "Entrar",
    goToFeed: "Ir para o feed",
    kicker: "Como funciona",
    title: "Da fonte ao post em 4 passos.",
    subtitle:
      "Um guia rápido para toda a redação. Leia o TL;DR, olhe a imagem e pronto.",
    tldr: "TL;DR",
    stepLabel: "Passo",
    steps: [
      {
        title: "Mande o que você tem",
        tldr: "Cole o texto, um link ou um PDF, adicione créditos e clique em Gerar.",
        points: [
          "Pode colar vários links de uma vez.",
          "O PDF precisa ter texto selecionável (foto de papel não funciona).",
          "Os créditos vão no fim da legenda, antes das hashtags.",
        ],
        alt: "Tela de nova pauta com um link colado e o botão de gerar",
      },
      {
        title: "A IA escreve, você ajusta",
        tldr: "A IA escreve título, subtítulo e legenda. Você escolhe e enquadra a foto.",
        points: [
          "Arraste e dê zoom na foto; arraste o título e o subtítulo para reposicionar.",
          "Título com até 69 caracteres, subtítulo com até 149.",
          "Vídeo também: ele é ajustado para 9:16 e ganha um título animado.",
        ],
        alt: "Editor com a foto enquadrada no template da marca",
      },
      {
        title: "Revise e decida",
        tldr: "Veja o post exatamente como vai ficar no Instagram e decida.",
        points: [
          "Aprovar e publicar: vai para o Instagram.",
          "Pedir reescrita: a IA gera uma nova versão do texto.",
          "Recusar: o post é arquivado com um motivo.",
        ],
        alt: "Tela de revisão com a prévia no estilo Instagram",
      },
      {
        title: "Acompanhe no feed",
        tldr: "Todas as pautas e o status de cada uma num lugar só.",
        points: [
          "Aprove ou recuse direto pelo card, sem abrir o post.",
          "Cada edição vira uma nova versão, com histórico completo.",
          "Posts antigos somem sozinhos: publicados após 2 dias, em revisão ou com falha após 3.",
        ],
        alt: "Feed de pautas com posts em revisão",
      },
    ],
    rulesTitle: "Três regras que nunca mudam",
    rules: [
      {
        title: "A IA não mexe na foto",
        text: "Ela só escreve. A foto é sempre real e escolhida por uma pessoa.",
      },
      {
        title: "Nada sai sem uma pessoa",
        text: "Nenhum post chega ao Instagram sem alguém aprovar.",
      },
      {
        title: "Nada se perde",
        text: "Cada geração ou edição cria uma nova versão; nada é sobrescrito.",
      },
    ],
    rolesTitle: "Quem faz o quê",
    roles: [
      { name: "Repórter", text: "Envia fontes e edita os próprios rascunhos." },
      {
        name: "Editor",
        text: "Aprova, recusa, pede reescrita e publica. Cuida dos templates e do estilo.",
      },
      { name: "Admin", text: "Tudo isso, mais usuários, chaves de API e configurações." },
    ],
    setupTitle: "Para o admin: configure uma vez",
    setupTldr:
      "Antes do primeiro post, deixe o JornAI com a cara da sua redação. Leva poucos minutos.",
    setup: [
      { name: "Empresa", text: "Nome, logo, @ do Instagram e cores da marca." },
      {
        name: "Templates",
        text: "Monte a moldura da foto: suba o PNG, posicione título e subtítulo, escolha tamanho, cor e alinhamento.",
      },
      {
        name: "Estilo da redação",
        text: "Cole alguns posts reais; a IA aprende o tom e o formato, nunca o conteúdo.",
      },
    ],
    setupAlt: "Construtor de templates com as caixas de título e subtítulo",
    ctaTitle: "Pronto para a primeira pauta?",
  },
  en: {
    metaTitle: "How it works — JornAI",
    metaDescription: "A quick guide to JornAI: from source to Instagram post in 4 steps.",
    signIn: "Sign in",
    goToFeed: "Go to the feed",
    kicker: "How it works",
    title: "From source to post in 4 steps.",
    subtitle: "A quick tour for the whole newsroom. Read the TL;DR, look at the picture, done.",
    tldr: "TL;DR",
    stepLabel: "Step",
    steps: [
      {
        title: "Send what you have",
        tldr: "Paste a text, a link or a PDF, add credits and click Generate.",
        points: [
          "Several links at once are fine.",
          "PDFs need selectable text (a photo of paper won't work).",
          "Credits go at the end of the caption, before the hashtags.",
        ],
        alt: "New story screen with a pasted link and the Generate button",
      },
      {
        title: "The AI writes, you adjust",
        tldr: "The AI writes the title, subtitle and caption. You pick and frame the photo.",
        points: [
          "Drag and zoom the photo; drag the title and subtitle to move them.",
          "Title up to 69 characters, subtitle up to 149.",
          "Video works too: it's fitted to 9:16 and gets an animated title.",
        ],
        alt: "Editor with the photo framed on the brand template",
      },
      {
        title: "Review and decide",
        tldr: "See the post exactly as it will look on Instagram, then decide.",
        points: [
          "Approve and publish: it goes to Instagram.",
          "Request rewrite: the AI writes a new version of the text.",
          "Reject: the post is archived with a reason.",
        ],
        alt: "Review screen with the Instagram-style preview",
      },
      {
        title: "Follow it in the feed",
        tldr: "Every story and its status in one place.",
        points: [
          "Approve or reject right from the card, without opening the post.",
          "Every edit is a new version, with the full history kept.",
          "Old posts clean themselves up: published after 2 days, in review or failed after 3.",
        ],
        alt: "Story feed with posts in review",
      },
    ],
    rulesTitle: "Three rules that never change",
    rules: [
      {
        title: "The AI never touches the photo",
        text: "It only writes. Photos are always real and chosen by a person.",
      },
      {
        title: "Nothing goes out without a person",
        text: "No post reaches Instagram until someone approves it.",
      },
      {
        title: "Nothing gets lost",
        text: "Every generation or edit is a new version; nothing is overwritten.",
      },
    ],
    rolesTitle: "Who does what",
    roles: [
      { name: "Reporter", text: "Sends sources and edits their own drafts." },
      {
        name: "Editor",
        text: "Approves, rejects, requests rewrites and publishes. Owns templates and style.",
      },
      { name: "Admin", text: "All of that, plus users, API keys and settings." },
    ],
    setupTitle: "For admins: set it up once",
    setupTldr:
      "Before the first post, make JornAI look and sound like your newsroom. It takes a few minutes.",
    setup: [
      { name: "Company", text: "Name, logo, Instagram handle and brand colors." },
      {
        name: "Templates",
        text: "Build the photo frame: upload the PNG, place the title and subtitle, pick size, color and alignment.",
      },
      {
        name: "Newsroom style",
        text: "Paste a few real posts; the AI learns the tone and format, never the content.",
      },
    ],
    setupAlt: "Template builder with the title and subtitle boxes",
    ctaTitle: "Ready for your first story?",
  },
};
