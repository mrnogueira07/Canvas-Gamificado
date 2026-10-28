# Linha Konecta Kids

Template: `resources/templates/konecta-kids.pptx` (slides 1 = capa, 2 = conteúdo branco,
3 = destaque roxo, 4 = final).

## Formato
- Slide 16:9 do estúdio, 53,45 x 30,22 polegadas. Entrega em PDF.
- Logo Konecta Kids no canto superior direito e traço roxo no canto inferior esquerdo:
  já estão no template.

## Tipografia (somente Lexend)
| Elemento | Fonte | Tamanho | Cor |
| --- | --- | --- | --- |
| Capa: nome do(a) professor(a) e tema | Lexend Medium | 100 pt | Preto |
| Rótulos "Objetivo:" e "Habilidade da BNCC:" | Lexend Medium | 100 pt | Roxo #571075 |
| Título do slide de conteúdo | Lexend Medium | 100 pt | Roxo #571075 |
| Título em slide de destaque (fundo roxo) | Lexend Medium | 100 pt | Branco |
| Texto | Lexend | 80 pt | Preto (branco no destaque) |
| Fonte da imagem | Lexend | 40 pt | Preto |

Os rótulos "NOME PROFESSOR (A):" e "TEMA DA AULA:" já vêm desenhados na capa.

## Cores
Roxo escuro #571075 (títulos e fundos); roxo médio #993DBC, verde-água #32DAC3, amarelo
#FFC500 e rosa #FE647C só em contornos de 10 pt ou barras laterais.

## Área de segurança
Mesma regra do estúdio: o quarto direito do slide fica livre para o professor.

## Linguagem para crianças
- Frases curtas e diretas, vocabulário do ano escolar.
- Máximo de 3 linhas ou 3 tópicos por slide; prefira imagem ao texto.
- Perguntas frequentes ao estudante ("Você já viu...?", "O que você acha...?").
- Ilustrações ou fotos coloridas, adequadas à faixa etária.

## Sequência
1. Capa: professor(a) e tema (campos `capa.professor` e `capa.tema`).
2. Objetivo e Habilidade da BNCC.
3. Conteúdo (fundo branco). Use `"fundo": "destaque"` para abrir o gancho, o resumo
   e os exercícios.
4. Slide final fixo (roxo com o logo).
