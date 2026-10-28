# Integração com o projeto

Os editores Slides Canvas, Roteiro de Gravação e Pacote da aula usam o briefing e as regras INNYX. O canvas de jogos permanece independente.

1. Preencha o briefing e cole a apostila completa (ou importe TXT/MD).
2. Gere e revise a estrutura. Confira o checklist, os tipos dos slides e a duração.
3. Salve o rascunho no navegador e clique em **Exportar .pptx**. O download monta a apresentação no navegador com textos editáveis e notas do apresentador.
4. A linha Konecta Kids utiliza o arquivo `public/templates/konecta-kids.pptx`, fornecido pelo usuário, com capa, objetivo/BNCC, conteúdo e encerramento. Fundos, logos, fontes incorporadas e temas são preservados. As outras linhas usam seus templates em `public/templates/`.

O script original permanece disponível para uso externo com JSON previamente preparado. Execute a partir de `tools/mind-canvas`:

```powershell
python -m pip install python-pptx
python .agents/skills/slides-canvas/scripts/montar_slides.py saida/AULA.json --pdf
```

O PDF pelo script exige LibreOffice. A interface oferece download direto em PPTX. Imagens sugeridas permanecem como orientações nas notas: revise e inclua as imagens antes de gravar. Textos que excedem o espaço do template são sinalizados para divisão antes da exportação. A importação da apostila na interface aceita texto, não PDF.

Os rascunhos anteriores continuam acessíveis. Se faltarem tipo ou duração, ajuste os campos antes de exportar. Os arquivos alterados originais estão em `backups/mind-canvas-before/`.

## Prompt e revisão

`src/lib/studioPrompts.ts` separa núcleo, módulos das linhas e formato de saída. `studioGuidelines.ts` monta o prompt com o briefing e executa o checklist; `studioGeneration.ts` valida o JSON interno e conserva etapa, layout, imagem, fórmula, notas, duração e pendências. O JSON permanece interno: o consultor baixa PPTX.

Uma segunda geração tenta corrigir problemas estruturais do checklist, preservando a primeira resposta completa se a correção falhar. Pendências de BNCC, autoria e busca de imagem continuam para revisão humana.

Gancho, resumo e exercício Kids usam o fundo roxo oficial extraído do pacote original, acrescentado como layout reutilizável ao template enviado. Capa, objetivo, conteúdo branco e encerramento usam os modelos enviados. Fórmulas mantêm a fonte definida e espaço livre. Os layouts de tópicos usam barras ou contornos sem preenchimento.

Mantidos os tamanhos definidos (sem redução automática de BNCC para 60 pt). Textos excessivos precisam ser divididos. A comparação pedagógica com uma apostila real e um exemplo aprovado ainda exige que esses materiais sejam fornecidos. As verificações locais usam conteúdo de exemplo.
