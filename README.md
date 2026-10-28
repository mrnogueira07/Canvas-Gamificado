# INNYX — Mind Canvas Studio & Game Canvas Generator

Plataforma educacional integrada para concepção, geração assistida por Inteligência Artificial e exportação de **Apresentações Didáticas (Slides Canvas)**, **Roteiros de Gravação**, **Pacotes de Aula** e **Jogos Educativos Gamificados** alinhados à BNCC.

> Documentação arquitetural completa com diagramas UML (Pacotes, Componentes, Classes/Domínio, Sequência e Estados): [`docs/ARQUITETURA_UML.md`](./docs/ARQUITETURA_UML.md).

---

## Arquitetura de Pastas (Alinhada por Domínio e Camadas UML)

```text
Canvas-Gamificado-main/
├── docs/                                   # Documentação Arquitetural e Modelagem UML
│   └── ARQUITETURA_UML.md                  # Diagramas de Pacotes, Componentes, Classes, Sequência e Estados
├── functions/                              # Backend Serverless (Firebase Cloud Functions v2)
│   └── src/
│       ├── index.ts                        # Gateway seguro Gemini (generateGeminiContent, listStorageFiles)
│       └── studioImage.ts                  # Geração de imagens IA (Magnific Mystic + Gemini Image)
├── public/                                 # Assets estáticos e Templates PPTX oficiais
│   └── templates/                          # Matrizes .pptx e capas (Konecta Kids, Konectar.me, Corporativo)
├── scripts/                                # Scripts utilitários de infraestrutura
│   └── check_storage.js                    # Diagnóstico de buckets do Firebase Storage
├── src/                                    # Aplicação Frontend (React 19 + TypeScript + Vite)
│   ├── App.tsx                             # Roteamento principal e guardas de autenticação (@innyx.com)
│   ├── main.tsx                            # Ponto de entrada da aplicação
│   ├── types.ts                            # Entidades e contratos do Game Canvas Generator
│   ├── context/                            # Contextos globais (ThemeContext)
│   ├── pages/                              # Camada de Apresentação (Views / Containers de Rota)
│   │   ├── Login.tsx                       # Login corporativo Google + Cloudflare Turnstile
│   │   ├── StudioHome.tsx                  # Hub unificado (Início, Projetos, Modelos, Ranking)
│   │   ├── StudioEditor.tsx                # Editor de Slides, Roteiros e Pacotes de Aula
│   │   ├── GeneratorPage.tsx               # Gerador e editor de Jogos Educativos
│   │   └── index.ts                        # Barrel export de páginas
│   ├── components/                         # Camada de Componentes dividida por Subpacotes de Domínio
│   │   ├── auth/                           # Autenticação e Segurança (Turnstile)
│   │   ├── ui/                             # Design System, Layout Shell e AppSidebar
│   │   ├── studio/                         # Componentes do Mind Canvas Studio (Slides, Preview, Imagens, Jobs)
│   │   ├── generator/                      # Componentes do Game Canvas (DocumentView, Sidebar, 11 Jogos)
│   │   ├── dashboard/                      # Organização em Pastas (FolderCard) e Ranking Docente
│   │   └── index.ts                        # Barrel export unificado de componentes
│   ├── lib/                                # Camada de Domínio, Serviços e Infraestrutura
│   │   ├── core/                           # Infraestrutura base (firebase, gemini)
│   │   ├── studio/                         # Serviços do Mind Canvas (Projects, Jobs, Generation, PPTX, PDF, Images)
│   │   ├── generator/                      # Serviços do Game Canvas (pdfExport)
│   │   └── index.ts                        # Barrel export unificado de serviços
│   └── styles/                             # Folhas de Estilo Modulares por Domínio
│       ├── global.css                      # Tokens globais e Tailwind CSS v4
│       ├── login.css                       # Estilos da tela de autenticação
│       ├── generator.css                   # Estilos do gerador de jogos
│       └── studio/                         # Estilos dedicados do Mind Canvas Studio
│           ├── studio.css
│           ├── studio-editor.css
│           ├── studio-slide-editor.css
│           ├── studio-deck-preview.css
│           └── studio-jobs.css
├── tests/                                  # Suíte de testes automatizados (Node Test Runner)
└── tools/mind-canvas/                      # Diretrizes pedagógicas, exemplos canônicos e recursos de slides
```

---

## Comandos Principais

```bash
# Instalar dependências
npm install

# Executar ambiente de desenvolvimento
npm run dev

# Compilar TypeScript e gerar build de produção
npm run build

# Executar suíte de testes unitários do Studio
node --test tests/studioBriefing.test.mjs tests/studioGeneration.test.mjs tests/studioImageBackend.test.mjs tests/studioImageMatching.test.mjs tests/studioJobs.test.mjs tests/studioNavigation.test.mjs
```
