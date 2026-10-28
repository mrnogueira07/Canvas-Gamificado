# Mind Canvas · Slides Canvas no Google Antigravity

Pacote que ensina o agente do Antigravity a criar os slides das videoaulas INNYX
(Konectar.me, Konecta Kids e Educação Corporativa) no padrão de cada linha.

## Instalação

1. Descompacte esta pasta e abra-a no Antigravity (File > Open Folder).
   Mantenha a pasta `.agents/` na raiz: é onde o Antigravity procura regras e skills.
2. No terminal do Antigravity, instale a biblioteca de PowerPoint uma única vez:
   `pip install python-pptx`
3. Para exportar PDF automaticamente, tenha o LibreOffice instalado. Sem ele, o .pptx
   é gerado normalmente e o PDF pode ser exportado pelo PowerPoint ou Google Slides.

## Como usar

1. Coloque o PDF ou o texto da apostila na pasta `apostilas/`.
2. No chat do agente, peça algo como:
   > Use a skill slides-canvas para criar os slides da linha Konectar.me, Ensino Médio,
   > 3º ano, 1º bimestre, Geografia, tema "Produção agropecuária e impactos ambientais",
   > a partir de apostilas/geo-3ano-cap2.pdf. Exercício: questão 4.
3. O agente pergunta o que faltar, gera o JSON em `saida/`, monta o .pptx e o PDF no
   template da linha e lista as pendências (imagens a buscar, BNCC a validar).

## O que tem aqui

| Caminho | Para que serve |
| --- | --- |
| `.agents/rules/mind-canvas.md` | Regra sempre ativa: idioma, BNCC, pastas |
| `.agents/skills/slides-canvas/SKILL.md` | Prompt núcleo e passo a passo do agente |
| `.agents/skills/slides-canvas/resources/linha-*.md` | Normas visuais de cada linha |
| `.agents/skills/slides-canvas/resources/formato-saida.md` | Formato do JSON e checklist |
| `.agents/skills/slides-canvas/resources/templates/` | Templates oficiais (.pptx) |
| `.agents/skills/slides-canvas/scripts/montar_slides.py` | Monta o .pptx e o PDF a partir do JSON |
| `.agents/skills/slides-canvas/examples/` | Exemplo de JSON pronto (Geografia) |
| `apostilas/` | Onde colocar o material da apostila |
| `saida/` | Onde ficam o JSON, o .pptx e o PDF gerados |

## Testar sem o agente

`python .agents/skills/slides-canvas/scripts/montar_slides.py .agents/skills/slides-canvas/examples/exemplo-konectar-me.json --pdf`

## Para atualizar

- Mudou uma norma visual? Edite o `linha-*.md` e, se for fonte, cor ou posição, a tabela
  `LINHAS` no começo do `montar_slides.py`.
- Mudou o template? Substitua o .pptx em `templates/` mantendo a mesma ordem de slides.
