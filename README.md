# 🕹️ JS Quest - Plataforma de Gamificação Educacional

![Preview do Projeto](https://via.placeholder.com/1200x600?text=JS+Quest+-+Aprenda+JavaScript+Jogando)

Uma aplicação web gamificada inspirada em plataformas educacionais modernas (como Duolingo e Mimo). O **JS Quest** foi desenvolvido para testar e aprimorar conhecimentos em JavaScript, abordando desde os fundamentos da linguagem até simulações de projetos reais de mercado (sistemas de delivery, controle de estoque, integrações de APIs e muito mais).

---

## 🚀 Funcionalidades

* **🗺️ Trilha de Aprendizado Modular:** Módulos progressivos desbloqueados sequencialmente conforme o avanço e pontuação do usuário.
* **🛡️ Backend Serverless Seguro (Vercel Functions):**
  * `api/modulos`: Higieniza e entrega as missões sem expor gabaritos ou explicações ao cliente.
  * `api/verificar`: Endpoint `POST` que valida as respostas diretamente no servidor, impedindo que o aluno descubra a resposta inspecionando o código no navegador.
* **🔁 Sistema de Revisão Dinâmica:** Questões respondidas incorretamente são enviadas automaticamente para uma aba especial de "Revisão". O sistema recria um módulo virtual e as remove da lista assim que corrigidas, reutilizando as rotas seguras do servidor.
* **🧪 Playground de Código Interativo:**
  * Aba dedicada para praticar métodos de array, strings e manipulação de DOM (`.map()`, `.filter()`, `.reduce()`, etc).
  * Execução dinâmica de código com `new Function()`, tratamento amigável de erros de sintaxe e comparação automática entre o resultado retornado e o esperado.
* **📊 Mini-Projetos Visuais (HTML5 Canvas):** Renderização de dashboards e gráficos dinâmicos via Context2D que reagem em tempo real ao desempenho do jogador.
* **💾 Persistência Antifraude (LocalStorage):** O progresso de XP, histórico de erros e módulos concluídos são armazenados localmente e protegidos por uma assinatura digital (Hash + Base64), prevenindo manipulação de dados via DevTools.
* **📱 Interface Responsiva & PWA:** Layout adaptável para Desktop e Mobile, com Service Worker configurado para cache de recursos essenciais e funcionamento offline.
* **🔊 Feedback Sonoro & Visual:** Efeitos sonoros para cliques, acertos, erros e conclusão de fases, acompanhados de modais explicativos.

---

## 🛠️ Tecnologias Utilizadas

* **HTML5:** Estrutura semântica, acessibilidade e views desacopladas (Dashboard, Exercícios, Playground e Revisão).
* **CSS3:** Design mobile-first e totalmente responsivo (Flexbox e CSS Grid), alinhamentos absolutos fluidos, animações customizadas e paleta visual inspirada no ecossistema JavaScript.
* **JavaScript (ES6+ Vanilla):** Lógica complexa de interface, manipulação de estado protegida com hashing, execução em sandbox, e consumo assíncrono de APIs (`async/await`, `fetch`).
* **HTML5 Canvas API:** Desenho de gráficos vetoriais interativos.
* **Vercel Serverless Functions:** Arquitetura de micro-serviços em Node.js para regras de negócio fechadas.
* **Service Workers (PWA):** Cache offline e recursos de aplicação web progressiva.
* **Bootstrap Icons:** Biblioteca de ícones vetoriais.

---

## 📂 Estrutura de Arquivos

```text
/
├── api/
│   ├── dados.json        # Base de questões e gabarito protegida no servidor
│   ├── modulos.js        # Serverless Function: Envio higienizado das questões
│   └── verificar.js      # Serverless Function: Validação segura de respostas
├── assets/
│   └── sounds/           # Efeitos sonoros do jogo (click, correct, wrong, completed)
├── index.html            # Estrutura principal e views da aplicação
├── style.css             # Estilos, variáveis e regras de responsividade (Media Queries)
├── script.js             # Lógica cliente: Autenticação de estado, Canvas, fluxo e Playground
├── sw.js                 # Service Worker (PWA / Cache offline)
├── manifest.json         # Manifesto PWA
└── README.md             # Documentação do projeto
```

---

## 🧠 Cenários Abordados nos Módulos

O currículo aborda situações reais encontradas no dia a dia do desenvolvimento:

* 🛵 **Lógica para Sistemas de Delivery:** Cálculos de taxas de entrega, janelas de horários e regras condicionais.
* 📦 **Manipulação Avançada de Arrays:** Gestão de inventário e transformação de dados.
* 💬 **Integração com WhatsApp:** Formatação e sanitização de URLs para atendimento automático.
* 🌐 **Consumo de APIs REST:** Requisições assíncronas com tratamento de erros.
* 💰 **Formatação Monetária:** Internacionalização com `Intl.NumberFormat`.

---

Desenvolvido por **Ronaldo Melo** como parte da jornada de especialização em **Desenvolvimento Web Full-Stack**.
