import { CORE_PROMPT, LINE_PROMPTS, OUTPUT_PROMPT } from "./studioPrompts";
import { studioFilename } from "./studioProjects";
import type { StudioProject } from "./studioProjects";

export const slideTypes = ["capa", "objetivo_bncc", "gancho", "conteudo", "interacao", "formula", "resumo", "exercicio", "gabarito", "encerramento"];
const KONECTAR_AULA_SINTESE = `# ESPECIFICAÇÃO — MODELO OFICIAL KONECTAR.ME · AULA SÍNTESE
Você é um designer instrucional e educador especialista da linha Konectar.me.
SUA MISSÃO CENTRAL: **Resumir o arquivo/apostila enviado e criar uma aula completa, dinâmica e de fácil compreensão para os estudantes entenderem os conceitos com clareza e entusiasmo.**

## 1. DIRETRIZES PEDAGÓGICAS E RESUMO DIDÁTICO
- SÍNTESE INTELIGENTE PARA O ALUNO:
  - Leia e compreenda todo o documento enviado, identifique os conceitos centrais e resuma-os com máxima clareza didática.
  - Não copie blocos longos, técnicos ou maçantes da apostila. Filtre o essencial: O que é? Por que importa? Como funciona na prática?
  - Sintetize as ideias em explicações diretas, fluidas e acessíveis para a faixa etária escolar.
  - Uma ideia central por slide: cada slide de desenvolvimento deve ensinar um passo lógico do conhecimento, sem sobrecarregar a memória do aluno.
  - Tópicos na tela: use de 3 a 4 tópicos curtos, marcantes e objetivos por slide (máximo 12 a 15 palavras por tópico), servindo como guia visual imediato para o estudante acompanhar a explicação.
- LINGUAGEM E DIÁLOGO COM O ESTUDANTE:
  - As notas do apresentador são o **roteiro de fala do professor ensinando o aluno**: fale com entusiasmo, acolhimento, linguagem calorosa e clareza.
  - Use perguntas que estimulem a reflexão ("Você já se perguntou por que...?", "Imagine que..."), utilize analogias simples e exemplos práticos do cotidiano para transformar temas abstratos em algo concreto e fácil de entender.
  - No gancho, instigue a curiosidade; nos conceitos, explique o "como" e o "porquê"; no exercício, convide o aluno a pausar o vídeo e tentar responder; no gabarito, explique por que a resposta está certa e esclareça dúvidas comuns.
- PROGRESSÃO DA APRENDIZAGEM (COMO ESTRUTURAR A AULA PARA O ALUNO APRENDER):
  - Etapa 1: Propósito Claro (Capa + Objetivo BNCC): O aluno sabe exatamente o que vai aprender e qual competência irá desenvolver.
  - Etapa 2: Conexão com a Realidade (Gancho): Conecte o tema a uma pergunta intrigante, curiosidade ou desafio cotidiano antes das teorias.
  - Etapa 3: Construção Passo a Passo (Desenvolvimento 1 e 2): O primeiro slide apresenta o conceito nuclear de forma simples. O segundo aprofunda com desdobramento, exemplo ou fórmula com área de cálculo.
  - Etapa 4: Consolidação Visual (Síntese / Linha do Tempo): Resumo dos marcos mais importantes para fixar o mapa mental da aula.
  - Etapa 5: Prática e Validação (Exercício + Gabarito comentado): O aluno testa o aprendizado com uma questão contextualizada e recebe a justificativa passo a passo.

## 2. DIRETRIZES VISUAIS E DE DIAGRAMAÇÃO DO MODELO OFICIAL
- TIPOGRAFIA E CORES OFICIAIS:
  - Fonte padrão obrigatória: Todo o slide tem que estar na fonte Montserrat Média (Medium) e 80pts.
  - Título do slide: Azul Konectar (#2796E1), Montserrat Média (Medium / 80pt), até 40 caracteres, sem ponto final.
  - Subtítulo: Azul Konectar (#2796E1), Montserrat Média (Medium / 80pt).
  - Texto e tópicos: Preto (#000000), Montserrat Média (Medium / 80pt).
  - Capa: Rótulos e valores em Montserrat Média (Medium / 80pt).
- ÁREA DE SEGURANÇA (1/4 DO SLIDE):
  - O quarto direito (1/4 da largura total do slide) é a ÁREA DE SEGURANÇA reservada estritamente para o corpo/vídeo do professor em estúdio.
  - NENHUM texto, elemento gráfico, imagem, tópico ou fórmula pode invadir o 1/4 direito do slide. Todo o conteúdo deve ficar perfeitamente diagramado nos 3/4 esquerdos (área útil).
  - Margem inferior: Deixar espaço livre na parte inferior para a barra de reprodução do vídeo.
- IMAGENS:
  - Devem ser colocadas preferencialmente ao lado esquerdo do layout (layout topicos_com_imagem).
  - A fonte da imagem deve ser indicada obrigatoriamente na parte inferior, em Montserrat 40pt. Use o crédito original quando estiver no material; caso contrário, identifique a apostila e a página sem inventar autoria.
  - Use somente imagens realmente extraídas do material enviado. A imagem escolhida e os tópicos do mesmo slide devem tratar da mesma ideia; confira a página, a legenda e o texto ao redor da imagem no catálogo.
  - Para cada imagem usada, retorne "imagem":{"id":"ID exato do catálogo","descricao":"o que a imagem mostra"}. Use layout "topicos_com_imagem" e apresente os tópicos correspondentes ao conteúdo ilustrado. Não atribua uma imagem a um slide só para preencher espaço.
  - Em "fonte_pag", informe a página do conteúdo de cada slide. Se usar uma imagem, inclua a página da imagem e mantenha o texto visível coerente com o contexto dessa página.
  - Quando não houver imagem pertinente ou a relação com o texto for incerta, use um layout sem imagem. Nunca crie imagem, legenda, página ou crédito inexistentes.
- TÓPICOS, SEPARAÇÃO DE CONTEÚDO E GRAFISMOS:
  - Para separação visual de parágrafos/tópicos, usar layouts como:
    - 'topicos_com_barras': tópicos com barras laterais coloridas alternadas (Laranja #F79646, Roxo #7030A0, Verde #9BBB59).
    - 'caixas_contorno': caixas com contorno colorido sem preenchimento alternando as mesmas cores.
    - 'topicos': tópicos objetivos diretos com espaçamento confortável.
- FÓRMULAS MATEMÁTICAS:
  - Contas ou fórmulas devem ficar em destaque no topo (layout formula ou formula_com_espaco), deixando área livre abaixo ("Espaço para desenvolvimento") para explicação do professor.

## 3. ESTRUTURA SEQUENCIAL OBRIGATÓRIA (9 a 10 slides)
Organize o conteúdo resumido em uma progressão lógica de aula completa:
1. Capa (tipo: capa, layout: capa): Tema central da aula e Disciplina de forma clara e direta.
2. Objetivo e Habilidades (tipo: objetivo_bncc, layout: objetivo_habilidades):
   - Objetivo de aprendizagem começando com verbo no infinitivo (até 20 palavras), dizendo claramente o que o aluno entenderá.
   - Habilidades BNCC (1 a 3 códigos com descrição), informadas ou sugeridas com clareza.
3. Gancho e Contextualização (tipo: gancho, layout: topicos ou topicos_com_imagem):
   - Pergunta provocadora instigante e primeiro bloco introdutório conectando com a realidade do aluno.
4. Desenvolvimento 1 (tipo: conteudo, layout: topicos, topicos_com_barras ou topicos_com_imagem):
   - Conceito principal resumido em 3-4 tópicos curtos e objetivos.
5. Desenvolvimento 2 (tipo: conteudo, layout: topicos, caixas_contorno ou formula):
   - Aprofundamento, exemplo prático ou fórmula em destaque com espaço para desenvolvimento.
6. Síntese / Linha do Tempo / Mapa-Resumo (tipo: resumo, layout: linha_do_tempo ou mapa_resumo):
   - Síntese rápida dos marcos ou conceitos fundamentais para consolidar o aprendizado na memória.
7. Exercício de Fixação (tipo: exercicio, layout: exercicio):
   - Enunciado objetivo e 4 alternativas (A, B, C, D) para o aluno testar o que aprendeu.
8. Gabarito Comentado (tipo: gabarito, layout: gabarito):
   - Alternativa correta em destaque e justificativa didática passo a passo (até 25 palavras).
9. Encerramento Oficial (tipo: encerramento, layout: encerramento):
   - Slide final limpo sem texto na tela (fundo azul oficial com a logo Konectar).

## 4. ROTEIRO DO PROFESSOR (NOTAS)
- Redija notas faladas completas para o apresentador em linguagem acolhedora, clara e adequada à faixa etária (cerca de 130 palavras/minuto).
- Use marcações de tempo [m:ss–m:ss] cobrindo de 180 a 300 segundos totais (3 a 5 minutos).
- No gancho faça a pergunta ao aluno; no desenvolvimento estimule reflexão; no exercício convide a pausar o vídeo; no gabarito explique o porquê da alternativa correta.
- Explique cada imagem junto dos tópicos que ela ilustra. A fala e o texto visível devem corresponder à imagem do mesmo slide.

## 4. SAÍDA JSON
Responda somente JSON válido no formato:
{
  "linha":"Konectar.me", "modalidade":"aula_sintese",
  "meta":{"duracao_estimada_min":4,"total_slides":9,"nome_arquivo":"AP_[DISCIPLINA]_[ANO]_[BIMESTRE]_[TEMA]"},
  "alertas":[],
  "slides":[
    {"numero":1,"tipo":"capa","layout":"capa","titulo":"Tema curto","topicos":[],"fonte_pag":[],"nota_apresentador":"[0:00–0:20] Boas-vindas e introdução ao tema...","tempo_seg":20},
    {"numero":2,"tipo":"objetivo_bncc","layout":"objetivo_habilidades","titulo":"Objetivo e habilidades","objetivo":"Compreender ...","habilidades":[{"codigo":"EF00XX00","texto":"Texto da habilidade","origem":"apostila|professor|sugerida_ia"}],"topicos":[],"fonte_pag":[],"nota_apresentador":"...","tempo_seg":25},
    {"numero":3,"tipo":"gancho","layout":"topicos","titulo":"Pergunta provocadora","topicos":["Tópico 1","Tópico 2"],"fonte_pag":["Página"],"nota_apresentador":"...","tempo_seg":30},
    {"numero":4,"tipo":"conteudo","layout":"topicos_com_imagem","titulo":"Conceito Central","topicos":["Ponto A","Ponto B","Ponto C"],"imagem":{"id":"ID exato do catálogo","descricao":"Descrição fiel da imagem"},"fonte_pag":["Página"],"nota_apresentador":"...","tempo_seg":45},
    {"numero":5,"tipo":"conteudo","layout":"caixas_contorno","titulo":"Aprofundamento","topicos":["Aspecto 1","Aspecto 2","Aspecto 3"],"fonte_pag":["Página"],"nota_apresentador":"...","tempo_seg":45},
    {"numero":6,"tipo":"resumo","layout":"linha_do_tempo","titulo":"Síntese da Aula","topicos":["Resumo do conteúdo"],"marcos":[{"rotulo":"Etapa 1","texto":"Descrição"},{"rotulo":"Etapa 2","texto":"Descrição"}],"fonte_pag":["Página"],"nota_apresentador":"...","tempo_seg":35},
    {"numero":7,"tipo":"exercicio","layout":"exercicio","titulo":"Vamos praticar","exerciseQuestion":"Enunciado da questão","alternativas":[{"letra":"A","texto":"Opção A","correta":false},{"letra":"B","texto":"Opção B","correta":true},{"letra":"C","texto":"Opção C","correta":false},{"letra":"D","texto":"Opção D","correta":false}],"fonte_pag":["Página"],"nota_apresentador":"...","tempo_seg":35},
    {"numero":8,"tipo":"gabarito","layout":"gabarito","titulo":"Gabarito comentado","alternativas":[{"letra":"B","texto":"Opção B","correta":true}],"justificativa":"Justificativa didática concisa da resposta.","fonte_pag":["Página"],"nota_apresentador":"...","tempo_seg":30},
    {"numero":9,"tipo":"encerramento","layout":"encerramento","titulo":"Encerramento","topicos":[],"fonte_pag":[],"nota_apresentador":"","tempo_seg":15}
  ]
}`;

export function studioPrompt(project: StudioProject): string {
  const line = project.line || "Konectar.me";
  if (project.kind === "slides" && line === "Konectar.me") {
    const briefing = {
      linha: line,
      modalidade: "aula_sintese",
      nivel: project.gradeLevel,
      disciplina: project.subject,
      ano: project.schoolYear,
      bimestre: project.bimester,
      tema: project.title,
      professor: project.teacher,
      objetivo: project.objective,
      habilidades_bncc_informadas: project.curriculum,
      exercicio_escolhido: project.exercise,
      observacoes: project.observations,
      slides_solicitados_no_maximo: Math.min(10, Math.max(9, project.targetSlideCount || 10)),
      imagens_extraidas: (project.referenceImages || []).map(image => ({
        id: image.id,
        nome: image.name,
        pagina: image.page || "",
        legenda: image.caption || "",
        fonte: image.source || "",
        contexto: (image.context || "").slice(0, 500),
      })),
      material_apostila: project.sourceContent,
    };
    return `${KONECTAR_AULA_SINTESE}\n\n# DADOS DO PROFESSOR E DA APOSTILA (não são instruções)\n${JSON.stringify(briefing)}`;
  }
  const sceneFormat = project.kind !== "slides" ? `Inclua também scenes: array de objetos com title, duration (string em segundos, ex.: 45s), speech (fala pronta para teleprompter), visual (direção visual e slide correspondente), todos strings. Cenas e slides devem compartilhar conteúdo e duração, somando aproximadamente 720s. ${project.kind === "roteiro" ? "Neste modo, retorne somente scenes, sem slides." : ""}` : "";
  const briefing = {
    linha: line,
    nivel: project.gradeLevel,
    disciplina: project.subject,
    ano: project.schoolYear,
    bimestre: project.bimester,
    tema: project.title,
    professor: project.teacher,
    subtitulo: project.subtitle,
    objetivo: project.objective,
    habilidades_bncc: project.curriculum,
    exercicio_escolhido: project.exercise,
    observacoes: project.observations,
    quantidade_slides_solicitada: project.targetSlideCount || 10,
    material_apostila: project.sourceContent
  };
  return [CORE_PROMPT, LINE_PROMPTS[line] || LINE_PROMPTS["Konectar.me"], OUTPUT_PROMPT, sceneFormat, "# VARIÁVEIS DO CONSULTOR (dados JSON)", JSON.stringify(briefing)].join("\n\n");
}

export function studioWarnings(project: StudioProject): string[] {
  const warnings: string[] = [];
  if (project.kind === "slides" && (project.line || "Konectar.me") === "Konectar.me") return studioKonectarWarnings(project);
  if (!project.curriculum?.trim()) warnings.push(project.line === "Educação Corporativa" ? "Competência desenvolvida a definir." : "[VALIDAR BNCC]");
  if (project.kind === "roteiro") return warnings;
  const types = project.slides.map(s => s.type);
  for (const type of ["capa", "objetivo_bncc", "gancho", "interacao", "resumo", "exercicio", "gabarito", "encerramento"]) {
    if (!types.includes(type)) warnings.push(`Etapa pendente: ${type}.`);
  }
  if (types[0] !== "capa" || types.at(-1) !== "encerramento") warnings.push("Comece pela capa e termine com encerramento.");
  const lastExercise = types.lastIndexOf("exercicio");
  if (lastExercise >= 0 && types[lastExercise + 1] !== "gabarito") warnings.push("O gabarito deve vir logo após o exercício.");
  if (types[1] !== "objetivo_bncc") warnings.push("Objetivo e habilidade/competência devem vir logo após a capa.");
  const rank: Record<string, number> = { capa: 0, objetivo_bncc: 1, gancho: 2, conteudo: 3, formula: 3, interacao: 3, resumo: 4, exercicio: 5, gabarito: 6, encerramento: 7 };
  if (types.some((type, index) => index > 0 && (rank[type || ""] ?? 3) < (rank[types[index - 1] || ""] ?? 3))) warnings.push("Revise a ordem: introdução, gancho, desenvolvimento/interação, resumo, exercício, gabarito e final.");
  const totalSlides = project.slides.length;
  const target = project.targetSlideCount || 10;
  if (totalSlides < 5) warnings.push(`Mínimo de 5 slides necessário (atualmente com ${totalSlides}).`);
  const contentCount = types.filter(type => !["capa", "objetivo_bncc", "encerramento"].includes(type || "")).length;
  if (contentCount < Math.max(2, target - 3)) warnings.push(`Apresentação com ${contentCount} slides de conteúdo; meta: ${target} slides totais.`);
  const total = project.slides.reduce((sum, slide) => sum + (slide.duration || 0), 0);
  if (Math.abs(total - 720) > 30) warnings.push(`Duração: ${total}s; ajuste para aproximadamente 720s.`);
  const kids = project.line === "Konecta Kids";
  project.slides.forEach((slide, index) => {
    const limit = kids ? 3 : /^\s*[-*•]/m.test(slide.content) || slide.layout === "topicos_com_barras" || slide.layout === "caixas_contorno" ? 4 : 5;
    if (slide.title.trim().split(/\s+/).length > 6) warnings.push(`Slide ${index + 1}: título com mais de 6 palavras.`);
    if (slide.content.split("\n").filter(s => s.trim()).length > limit) warnings.push(`Slide ${index + 1}: revise o limite de ${limit} tópicos.`);
    if (!slide.notes.trim()) warnings.push(`Slide ${index + 1}: faltam notas do apresentador.`);
    else {
      const sentences = slide.notes.trim().split(/(?<=[.!?])\s+/).length;
      if (sentences < 2 || sentences > 4) warnings.push(`Slide ${index + 1}: use 2 a 4 frases nas notas do apresentador.`);
    }
    if (!slide.duration) warnings.push(`Slide ${index + 1}: informe o tempo estimado.`);
    if ((slide.type === "formula" || slide.layout === "formula_com_espaco") && !slide.formula?.trim()) warnings.push(`Slide ${index + 1}: informe a fórmula em destaque.`);
    if (slide.image?.description) {
      if (!slide.image.url) warnings.push(`Slide ${index + 1}: [BUSCAR IMAGEM] ${slide.image.description}`);
      if (!slide.image.source.startsWith("Fonte:") || /VALIDAR|\(autor\)|\(banco/i.test(slide.image.source)) warnings.push(`Slide ${index + 1}: [VALIDAR FONTE] da imagem.`);
    }
    slide.pending?.filter(Boolean).forEach(pending => warnings.push(`Slide ${index + 1}: ${pending}`));
  });
  return [...new Set(warnings)];
}

function studioKonectarWarnings(project: StudioProject): string[] {
  const warnings: string[] = [...(project.alerts || [])];
  const slides = project.slides;
  const types = slides.map(slide => slide.type || "conteudo");
  const expected = ["capa", "objetivo_bncc", "gancho"];
  if (slides.length < 9) warnings.push(`A Aula Síntese deve ter pelo menos 9 slides; atualmente tem ${slides.length}.`);
  const hasExerciseContinuation = types.filter(t => t === "exercicio").length > 1;
  const maxSlides = hasExerciseContinuation ? 11 : 10;
  if (slides.length > maxSlides) warnings.push(`A Aula Síntese permite no máximo ${maxSlides} slides; atualmente tem ${slides.length}.`);
  expected.forEach((type, index) => { if (types[index] !== type) warnings.push(`Slide ${index + 1}: a sequência deve começar com ${type}.`); });
  if (types.at(-1) !== "encerramento") warnings.push("O último slide deve ser o encerramento oficial, sem texto.");
  if (types.filter(type => ["conteudo", "interacao", "formula"].includes(type)).length < 2) warnings.push("Inclua pelo menos dois slides de desenvolvimento baseados na apostila.");
  const recap = types.findIndex(type => type === "resumo");
  if (recap < 0) warnings.push("Inclua um mapa-resumo ou linha do tempo antes do exercício.");
  const exercise = types.indexOf("exercicio");
  const lastExercise = types.lastIndexOf("exercicio");
  if (lastExercise < 0 || types[lastExercise + 1] !== "gabarito") warnings.push("Inclua o exercício da fonte seguido imediatamente pelo gabarito.");
  if (recap >= 0 && exercise >= 0 && recap > exercise) warnings.push("O mapa-resumo ou linha do tempo deve vir antes do exercício.");
  if (types[1] === "objetivo_bncc") {
    const objective = slides[1]?.objective || project.objective;
    if (!objective?.trim() || !/^[A-Za-zÀ-ÿ]+(?:[- ][A-Za-zÀ-ÿ]+)*r\b/i.test(objective.trim().split(/\s+/)[0])) warnings.push("O objetivo deve começar com um verbo no infinitivo.");
    if ((objective || "").trim().split(/\s+/).filter(Boolean).length > 20) warnings.push("O objetivo deve ter no máximo 20 palavras.");
  }
  const duration = slides.reduce((sum, slide) => sum + (slide.duration || 0), 0);
  if (duration < 180 || duration > 300) warnings.push(`A duração total deve ficar entre 180 e 300 segundos; está em ${duration}s.`);
  slides.forEach((slide, index) => {
    if (slide.type !== "capa" && slide.type !== "encerramento" && slide.type !== "objetivo_bncc") {
      if (!slide.sourcePages?.trim()) warnings.push(`Slide ${index + 1}: informe a página da apostila ou marque que a paginação não foi identificada.`);
      else if (/não identificada|nao identificada/i.test(slide.sourcePages)) warnings.push(`Slide ${index + 1}: confirme manualmente a página da apostila; a paginação não foi identificada na extração.`);
    }
    if (["gancho", "conteudo", "interacao", "formula", "resumo"].includes(slide.type || "") && !slide.content.trim() && !slide.highlight?.trim() && !slide.formula?.trim() && !slide.columns?.some(column => column.title.trim() || column.items.some(item => item.trim())) && !slide.timelineItems?.some(item => item.label.trim() || item.text?.trim())) {
      warnings.push(`Slide ${index + 1}: conteúdo principal vazio; inclua o texto ou os tópicos da apostila.`);
    }
    if (slide.title.length > 40) warnings.push(`Slide ${index + 1}: o título ultrapassa 40 caracteres.`);
    const topics = slide.content.split("\n").map(item => item.trim()).filter(Boolean);
    const layout = slide.layout || "topicos";
    const maxTopicLength = layout === "topicos_com_imagem" ? 55 : layout === "comparacao" ? 35 : 90;
    if (["topicos", "topicos_com_imagem"].includes(layout) && (topics.length < 3 || topics.length > 4)) warnings.push(`Slide ${index + 1}: use de 3 a 4 tópicos nesse layout.`);
    if (topics.some(topic => topic.length > maxTopicLength)) warnings.push(`Slide ${index + 1}: reduza os tópicos para até ${maxTopicLength} caracteres.`);
    if (layout === "comparacao" && (slide.columns?.length !== 2 || slide.columns.some(column => column.items.length > 3 || column.items.some(item => item.length > 35)))) warnings.push(`Slide ${index + 1}: limite a comparação a duas colunas, com até 3 itens de 35 caracteres cada.`);
    if (layout === "linha_do_tempo" && (!slide.timelineItems || slide.timelineItems.length < 4 || slide.timelineItems.length > 6 || slide.timelineItems.some(item => item.label.length > 25))) warnings.push(`Slide ${index + 1}: a linha do tempo precisa de 4 a 6 marcos, com rótulos de até 25 caracteres.`);
    if (slide.highlight && slide.highlight.length > 60) warnings.push(`Slide ${index + 1}: o destaque deve ter até 60 caracteres.`);
    if (!slide.notes.trim() && slide.type !== "encerramento") warnings.push(`Slide ${index + 1}: faltam notas de apresentação.`);
    if (slide.type !== "encerramento" && slide.notes.trim() && !/\[\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}\]/.test(slide.notes)) warnings.push(`Slide ${index + 1}: inclua o intervalo de tempo nas notas, no formato [m:ss–m:ss].`);
    if (slide.skills?.some(skill => /sugerida pela IA/i.test(skill))) warnings.push("Há habilidade BNCC sugerida pela IA; valide o código e o texto antes da gravação.");
    if (slide.type === "exercicio" && !slide.exerciseQuestion?.trim()) warnings.push("Questão completa pendente: inclua um exercício da apostila ou baseado no conteúdo enviado.");
    if (slide.exerciseQuestion && slide.exerciseQuestion.length > 260) warnings.push(`Slide ${index + 1}: o enunciado deve ter até 260 caracteres.`);
    if (slide.alternatives?.some(option => option.text.length > 120)) warnings.push(`Slide ${index + 1}: cada alternativa deve ter até 120 caracteres.`);
    if (slide.type === "gabarito" && !slide.justification?.trim()) warnings.push("Inclua uma justificativa curta do gabarito baseada na apostila.");
    if (slide.image && !slide.image.url) warnings.push(`Slide ${index + 1}: imagem do material não localizada; revise a associação com o texto.`);
    if (slide.image?.url && !/^Fonte:\s*.+/i.test(slide.image.source)) warnings.push(`Slide ${index + 1}: informe a fonte da imagem antes de apresentar.`);
    slide.pending?.filter(Boolean).forEach(item => warnings.push(`Slide ${index + 1}: ${item}`));
  });
  return [...new Set(warnings)];
}

export function studioCanvasJson(project: StudioProject) {
  const stage: Record<string, string> = { capa: "introducao", objetivo_bncc: "introducao", resumo: "conclusao", exercicio: "exercicio", gabarito: "gabarito", encerramento: "encerramento" };
  return {
    ...((project.line || "Konectar.me") === "Konectar.me" ? { modalidade: "aula_sintese", alertas: project.alerts || [], meta: { total_slides: project.slides.length, duracao_estimada_min: project.slides.reduce((sum, s) => sum + (s.duration || 0), 0) / 60, nome_arquivo: studioFilename(project) } } : {}),
    arquivo: studioFilename(project),
    linha: project.line || "Konectar.me",
    duracao_estimada_min: project.slides.reduce((sum, s) => sum + (s.duration || 0), 0) / 60,
    capa: { tema: project.title, disciplina: project.subject, professor: project.teacher || "", titulo: project.title, subtitulo: project.subtitle || "" },
    slides: project.slides.map((slide, index) => ({
      numero: index + 1, etapa: slide.stage || stage[slide.type || ""] || "desenvolvimento", tipo: slide.type || "conteudo",
      layout: slide.layout || (slide.type === "formula" ? "formula_com_espaco" : "so_texto"),
      ...(project.line === "Konecta Kids" && ["gancho", "resumo", "exercicio"].includes(slide.type || "") ? { fundo: "destaque" } : {}),
      titulo: slide.title, texto: slide.content.split("\n").filter(s => s.trim()),
      objetivo: slide.type === "objetivo_bncc" ? slide.objective || project.objective : "",
      habilidade: slide.type === "objetivo_bncc" ? slide.curriculum || project.curriculum || "[VALIDAR BNCC]" : "",
      formula: slide.formula || (slide.type === "formula" ? slide.content : ""),
      ...(slide.image ? { imagem: { id: slide.image.referenceId || "", descricao: slide.image.description, legenda: slide.image.caption || "", pagina: slide.image.page || "", fonte: slide.image.source, status: slide.image.status } } : {}),
      ...(slide.sourcePages ? { fonte_pag: slide.sourcePages.split(",").map(page => page.trim()).filter(Boolean) } : {}),
      ...(slide.skills?.length ? { habilidades: slide.skills } : {}),
      ...(slide.highlight ? { destaque: slide.highlight } : {}),
      ...(slide.columns ? { colunas: slide.columns.map(column => ({ titulo: column.title, itens: column.items })) } : {}),
      ...(slide.timelineItems ? { marcos: slide.timelineItems.map(item => ({ rotulo: item.label, texto: item.text || "" })) } : {}),
      ...(slide.exerciseQuestion ? { exerciseQuestion: slide.exerciseQuestion } : {}),
      ...(slide.alternatives ? { alternativas: slide.alternatives.map(option => ({ letra: option.label, texto: option.text, correta: option.correct })) } : {}),
      ...(slide.justification ? { justificativa: slide.justification } : {}),
      nota_apresentador: slide.notes, tempo_seg: slide.duration || 0,
      pendencias: [...(slide.pending || []), ...(!project.curriculum && project.line !== "Educação Corporativa" ? ["[VALIDAR BNCC]"] : [])],
    })),
  };
}
