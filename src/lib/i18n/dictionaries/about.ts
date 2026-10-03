export const about = {
  pt: {
    metaTitle: "Como funciona — JornAI",
    metaDescription:
      "JornAI é open source: clone no GitHub, coloque a sua chave de API, configure a sua empresa e publique no Instagram em 4 passos.",
    cloneCta: "Clonar no GitHub",
    kicker: "Como funciona",
    badge: "Open source · MIT",
    title: "Da fonte ao post em 4 passos.",
    subtitle: "Um guia rápido para toda a redação.",
    ossTitle: "É open source: rode o seu, não use o nosso.",
    ossText:
      "O JornAI não é um serviço para criar conta e entrar. Clone o repositório no GitHub, coloque a sua chave de API, configure a sua empresa e está valendo. O painel que roda neste endereço é só uma vitrine — não precisa abri-lo.",
    ossSteps: [
      { name: "Clone", text: "Copie o projeto do GitHub para a sua máquina ou servidor." },
      { name: "Chave de API", text: "Coloque a chave do provedor de IA no .env." },
      { name: "Sua empresa", text: "Nome, logo, @ e cores — e já pode publicar." },
    ],
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
          "Mais de uma foto? Vira carrossel: a capa leva o template, as outras vão limpas.",
          "Vídeo também: ele é ajustado para 9:16 e ganha um título animado.",
        ],
        alt: "Editor com a foto enquadrada no template da marca",
      },
      {
        title: "Revise e decida",
        tldr: "Veja o post exatamente como vai ficar no Instagram e decida.",
        points: [
          "Aprovar e publicar: vai para o Instagram.",
          "Marque “Adicionar ao story também” para a arte ir para o story junto (vem sempre desmarcado).",
          "Pedir reescrita: a IA gera uma nova versão do texto.",
          "Recusar: o post é arquivado com um motivo.",
        ],
        alt: "Tela de revisão com a prévia do carrossel e a opção de adicionar ao story",
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
    photoKicker: "Carrossel, edição e story",
    photoTitle: "Várias fotos, rostos protegidos, story junto.",
    photoLead:
      "Monte um carrossel de até 10 fotos, edite cada imagem sem sair do JornAI e, na hora de publicar, mande a arte para o story também.",
    photoFeatures: [
      {
        title: "Carrossel de até 10 fotos",
        text: "A 1ª foto é a capa, com o template, o título e o subtítulo; as outras saem como a foto pura, na mesma proporção. Reordene, troque a capa e enquadre cada uma.",
      },
      {
        title: "Desfoque rostos",
        text: "Na aba “Borrar imagem”, toque ou arraste sobre a foto para esconder rostos, placas ou o que precisar. Dá para desfazer.",
      },
      {
        title: "Ajustes e cor",
        text: "Zoom, endireitar, girar, espelhar, brilho, contraste e saturação — e as bordas borradas, que mostram a foto inteira, como nos vídeos.",
      },
      {
        title: "Story com um clique",
        text: "Na revisão, marque “Adicionar ao story também”. Depois do post, a arte (no carrossel, só a capa) ou o vídeo vai para o story. Se o story falhar, o post continua no ar e a tela mostra o motivo.",
      },
    ],
    carouselAlt: "Seção de carrossel com a capa, a segunda foto e os botões de reordenar, enquadrar e editar",
    photoEditorAlt: "Editor de imagem na aba de desfoque, com o rosto da pessoa desfocado",
    videoKicker: "Vídeo e Reels",
    videoTitle: "Tem vídeo? Também sai com a cara da marca.",
    videoLead:
      "Suba um MP4, MOV ou WebM e o JornAI entrega um Reels 9:16 com título animado e o logo da empresa, pronto para publicar.",
    videoFeatures: [
      {
        title: "Qualquer formato vira 9:16",
        text: "Aceita MP4, MOV e WebM de até 100 MB. O resultado sai sempre em 1080×1920, a 30 quadros por segundo.",
      },
      {
        title: "Vídeo deitado, sem corte",
        text: "Um vídeo 16:9 aparece inteiro e centralizado, com um fundo desfocado em volta. Se um vídeo vertical precisar ser cortado, o editor avisa quanto da imagem fica de fora.",
      },
      {
        title: "Título animado",
        text: "O texto entra com animação logo no início, fica na tela o vídeo todo e some suavemente pouco antes do fim.",
      },
      {
        title: "Três estilos de cartão",
        text: "Clássico, Claro e Destaque. Os dois últimos usam as cores da sua marca, e o logo da empresa entra logo abaixo do texto.",
      },
      {
        title: "Réguas do Reels",
        text: "Ajuste a altura do texto. As faixas amarelas mostram o que a interface do Reels cobre, e o texto nunca passa delas.",
      },
      {
        title: "Prévia fiel e histórico",
        text: "A prévia usa um frame do meio do vídeo e as mesmas medidas do render final. Depois é o fluxo normal: revisão, aprovação e versões.",
      },
    ],
    videoAlt: "Editor de vídeo com a prévia 9:16, as réguas do Reels e o controle de altura do texto",
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
    tabsAlt:
      "Painel de administração com as abas Estilo da redação, Templates, Usuários, Chaves de API, Empresa, Configurações e Saldo de IA",
    tabsCaption: "Tudo fica nas abas do Admin: estilo, templates, usuários, chaves, empresa e configurações.",
    ctaTitle: "Pronto? Clone, coloque a sua chave e configure a sua empresa.",
    ctaText: "Faça o seu próprio projeto. Não precisa abrir o dashboard desta página.",
  },
  en: {
    metaTitle: "How it works — JornAI",
    metaDescription:
      "JornAI is open source: clone it from GitHub, add your API key, set up your company and publish to Instagram in 4 steps.",
    cloneCta: "Clone on GitHub",
    kicker: "How it works",
    badge: "Open source · MIT",
    title: "From source to post in 4 steps.",
    subtitle: "A quick tour for the whole newsroom.",
    ossTitle: "It's open source: run your own, don't use ours.",
    ossText:
      "JornAI isn't a service where you sign up and log in. Clone the repository from GitHub, add your API key, set up your company and you're good to go. The dashboard running at this address is just a showcase — you don't need to open it.",
    ossSteps: [
      { name: "Clone", text: "Copy the project from GitHub to your machine or server." },
      { name: "API key", text: "Put your AI provider key in the .env file." },
      { name: "Your company", text: "Name, logo, handle and colors — then start publishing." },
    ],
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
          "More than one photo? It becomes a carousel: the cover gets the template, the rest go out bare.",
          "Video works too: it's fitted to 9:16 and gets an animated title.",
        ],
        alt: "Editor with the photo framed on the brand template",
      },
      {
        title: "Review and decide",
        tldr: "See the post exactly as it will look on Instagram, then decide.",
        points: [
          "Approve and publish: it goes to Instagram.",
          "Tick “Add to story too” to send the art to the story as well (it always starts unticked).",
          "Request rewrite: the AI writes a new version of the text.",
          "Reject: the post is archived with a reason.",
        ],
        alt: "Review screen with the carousel preview and the add-to-story option",
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
    photoKicker: "Carousel, editing and story",
    photoTitle: "Several photos, faces protected, story included.",
    photoLead:
      "Build a carousel of up to 10 photos, edit each image without leaving JornAI and, when you publish, send the art to the story too.",
    photoFeatures: [
      {
        title: "Carousels of up to 10 photos",
        text: "The 1st photo is the cover, with the template, title and subtitle; the others go out as the bare photo, in the same proportion. Reorder, swap the cover and frame each one.",
      },
      {
        title: "Blur faces",
        text: "In the “Blur image” tab, tap or drag over the photo to hide faces, plates or anything else. You can undo it.",
      },
      {
        title: "Adjustments and color",
        text: "Zoom, straighten, rotate, mirror, brightness, contrast and saturation — plus blurred borders, which show the whole photo, like in the videos.",
      },
      {
        title: "Story in one click",
        text: "On review, tick “Add to story too”. After the post, the art (carousel: cover only) or the video goes to the story. If the story fails, the post stays up and the screen shows why.",
      },
    ],
    carouselAlt: "Carousel section with the cover, the second photo and the reorder, frame and edit buttons",
    photoEditorAlt: "Image editor on the blur tab, with the person's face blurred",
    videoKicker: "Video and Reels",
    videoTitle: "Got a video? It comes out on brand too.",
    videoLead:
      "Upload an MP4, MOV or WebM and JornAI hands back a 9:16 Reels video with an animated title and your company logo, ready to publish.",
    videoFeatures: [
      {
        title: "Any format becomes 9:16",
        text: "Accepts MP4, MOV and WebM up to 100 MB. The result is always 1080×1920 at 30 frames per second.",
      },
      {
        title: "Landscape video, no cropping",
        text: "A 16:9 video shows whole and centered, with a blurred background around it. If a vertical video does need cropping, the editor tells you how much of the image is cut off.",
      },
      {
        title: "Animated title",
        text: "The text animates in near the start, stays on screen for the whole video and fades out gently just before the end.",
      },
      {
        title: "Three card styles",
        text: "Classic, Light and Bold. The last two use your brand colors, and the company logo sits right below the text.",
      },
      {
        title: "Reels guides",
        text: "Adjust the text height. The yellow bands show what the Reels interface covers, and the text never crosses them.",
      },
      {
        title: "Faithful preview and history",
        text: "The preview uses a frame from the middle of the video and the same measurements as the final render. After that it's the usual flow: review, approval and versions.",
      },
    ],
    videoAlt: "Video editor with the 9:16 preview, the Reels guides and the text height control",
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
    tabsAlt:
      "Administration panel with the Newsroom style, Templates, Users, API keys, Company, Settings and AI balance tabs",
    tabsCaption: "Everything lives in the Admin tabs: style, templates, users, keys, company and settings.",
    ctaTitle: "Ready? Clone it, add your key and set up your company.",
    ctaText: "Make your own project. You don't need to open the dashboard on this page.",
  },
};
