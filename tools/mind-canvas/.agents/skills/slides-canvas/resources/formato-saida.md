# Formato de saída

Salve um único JSON válido em `saida/<arquivo>.json`. O script `montar_slides.py` lê este
arquivo e monta o .pptx no template da linha.

```json
{
  "arquivo": "AP_GEO_3ANO_1BIM_PRODUÇÃO AGROPECUÁRIA E IMPACTOS AMBIENTAIS",
  "linha": "Konectar.me | Konecta Kids | Educação Corporativa",
  "duracao_estimada_min": 12,
  "capa": {
    "tema": "Konectar.me e Kids",
    "disciplina": "Konectar.me",
    "professor": "Konecta Kids",
    "titulo": "Educação Corporativa",
    "subtitulo": "Educação Corporativa"
  },
  "slides": [
    {
      "numero": 1,
      "etapa": "introducao | desenvolvimento | conclusao | exercicio | gabarito | encerramento",
      "tipo": "capa | objetivo_bncc | gancho | conteudo | interacao | formula | resumo | exercicio | gabarito | encerramento",
      "layout": "so_texto | imagem_esquerda_texto_direita | topicos_com_barras | caixas_contorno | formula_com_espaco",
      "fundo": "destaque (opcional; só Konecta Kids: fundo roxo para abrir gancho, resumo e exercícios)",
      "titulo": "Até 6 palavras",
      "texto": ["Tópico ou frase curta"],
      "objetivo": "Só no tipo objetivo_bncc",
      "habilidade": "Só no tipo objetivo_bncc: (CÓDIGO) texto da habilidade ou competência",
      "imagem": { "descricao": "O que a imagem mostra", "fonte": "Fonte: (autor) / (banco).", "arquivo": "caminho opcional da imagem" },
      "formula": "Só no layout formula_com_espaco",
      "nota_apresentador": "2 a 4 frases do que o professor fala",
      "tempo_seg": 45,
      "pendencias": ["[VALIDAR BNCC]"]
    }
  ]
}
```

## Nome do arquivo

`AP_[DISCIPLINA]_[ANO]_[BIMESTRE]_[TEMA EM MAIÚSCULAS]`
Ex.: `AP_GEO_3ANO_1BIM_PRODUÇÃO AGROPECUÁRIA E IMPACTOS AMBIENTAIS`

## Qual layout usar

| Situação | layout |
| --- | --- |
| Conceito curto ou pergunta | so_texto |
| Conceito explicado com imagem | imagem_esquerda_texto_direita |
| Lista de 2 a 4 itens paralelos | topicos_com_barras |
| Comparar 2 ou 3 ideias | caixas_contorno |
| Conta ou fórmula a resolver | formula_com_espaco |

## Checklist (rode antes de montar)

- [ ] Capa preenchida conforme a linha
- [ ] Slide de Objetivo e Habilidade BNCC (Corporativa: Competência), sem código inventado
- [ ] Gancho de abertura antes do conteúdo
- [ ] Pelo menos um slide de interação com a realidade do estudante
- [ ] Resumo da aula em tópicos
- [ ] Slide de exercício seguido de gabarito descritivo
- [ ] Máximo de 5 linhas ou 4 tópicos por slide (Kids: 3)
- [ ] Toda imagem com descrição e linha de fonte
- [ ] Soma de `tempo_seg` perto de 720
- [ ] Último slide do tipo `encerramento`
