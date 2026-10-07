
// Registro do Service Worker (PWA)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado com sucesso!', reg))
            .catch(err => console.error('Erro ao registrar Service Worker:', err));
    });
}

// ==========================================
// SISTEMA DE SEGURANÇA ANTIFRAUDE (HASH + BASE64)
// ==========================================
const SECRET_SALT = "jsquest_super_secreto_2026_xpto";

function gerarHashSeguro(texto) {
    let hash = 0;
    for (let i = 0; i < texto.length; i++) {
        const char = texto.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

function carregarProgressoSeguro() {
    const dadosSalvos = localStorage.getItem('jsQuestData');
    if (dadosSalvos) {
        try {
            const pacote = JSON.parse(dadosSalvos);
            if (pacote.payload && pacote.hash) {
                const jsonString = atob(pacote.payload); // Reverte o Base64
                const hashCalculada = gerarHashSeguro(jsonString + SECRET_SALT);
                
                if (hashCalculada === pacote.hash) {
                    return JSON.parse(jsonString); // Assinatura bateu certo!
                } else {
                    console.error("Tentativa de manipulação detetada! Progresso resetado.");
                    localStorage.removeItem('jsQuestData');
                }
            }
        } catch (erro) {
            localStorage.removeItem('jsQuestData');
        }
    }
    return { xp: 0, completedModules: [] };
}

// Gerenciamento de Estado (Agora usando o carregamento seguro)
let userData = carregarProgressoSeguro();

let curriculum = [];
let currentModule = null;
let currentQuestionIndex = 0;
let selectedOptionIndex = null;
let acertosNoMiniProjeto = 0;

//(Injeção de Texto e Botão Dinâmico)
const shortcutBtns = document.querySelectorAll('.shortcut-btn');
const dynamicShortcut = document.getElementById('dynamic-shortcut');

//(Tornar o código inteligente)
const mobileCodeInput = document.getElementById('mobile-code-input');

// Configurações do Canvas
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Elementos do DOM
const dashboard = document.getElementById('dashboard');
const modulesContainer = document.getElementById('modules-container');
const loadingState = document.getElementById('loading-state');
const exerciseArea = document.getElementById('exercise-area');
const btnCloseExercise = document.getElementById('btn-close-exercise');
const questionContainer = document.getElementById('question-container');
const optionsContainer = document.getElementById('options-container');
const btnVerify = document.getElementById('btn-verify');
const xpCounter = document.getElementById('xp-counter');
const progressBar = document.getElementById('exercise-progress');
const canvasContainer = document.getElementById('canvas-container');

const exerciseBox = document.getElementById('main-exercise-box');
const completionScreen = document.getElementById('completion-screen');
const completedModuleName = document.getElementById('completed-module-name');
const btnReturnDashboard = document.getElementById('btn-return-dashboard');

// Elementos de feedback
const feedbackPanel = document.getElementById('feedback-panel');
const feedbackTitle = document.getElementById('feedback-title');
const feedbackText = document.getElementById('feedback-text');

const somClick = new Audio('./assets/sounds/click.mp3');
const somCorrect = new Audio('./assets/sounds/correct.mp3');
const somWrong = new Audio('./assets/sounds/wrong.mp3');
const somCompleted = new Audio('./assets/sounds/completed.mp3');

//botão de digas
const btnHint = document.getElementById('btn-hint');
const pgHintBox = document.getElementById('pg-hint-box');
const pgHintText = document.getElementById('pg-hint-text');

// Inicialização chamando a nossa nova API segura
async function init() {
    updateUI();
    try {
        // Agora fazemos fetch na nossa pasta /api no servidor
        const response = await fetch('./api/modulos');

        if (!response.ok) throw new Error("Falha ao carregar dados do servidor");

        curriculum = await response.json();

        loadingState.classList.add('hidden');
        modulesContainer.classList.remove('hidden');
        renderModules();
    } catch (error) {
        loadingState.innerHTML = `<p style="color: red;">Erro ao carregar servidor. Verifique sua conexão.</p>`;
        console.error(error);
    }
}

function updateUI() {
    xpCounter.textContent = `${userData.xp} XP`;
}

function saveProgress() {
    // 1. Converte para texto
    const jsonString = JSON.stringify(userData);
    
    // 2. Ofusca em Base64
    const dadosOfuscados = btoa(jsonString);
    
    // 3. Cria a assinatura com a senha secreta
    const assinatura = gerarHashSeguro(jsonString + SECRET_SALT);
    
    // 4. Guarda apenas o pacote criptografado
    const pacoteSeguro = {
        payload: dadosOfuscados,
        hash: assinatura
    };
    
    localStorage.setItem('jsQuestData', JSON.stringify(pacoteSeguro));
    updateUI();
}

function renderModules() {
    modulesContainer.innerHTML = '';

    curriculum.forEach((mod, index) => {
        // Bloqueia o módulo se o anterior não estiver concluído
        const isLocked = index > 0 && !userData.completedModules.includes(curriculum[index - 1].id);
        const isCompleted = userData.completedModules.includes(mod.id);

        const card = document.createElement('div');
        card.className = `module-card ${isLocked ? 'locked' : ''}`;

        card.innerHTML = `
            <div class="module-info">
                <h3>${mod.title} ${isCompleted ? '<i class="bi bi-check-circle-fill" style="color: green;"></i>' : ''}</h3>
                <p>${mod.description}</p>
            </div>
            <div class="module-icon">
                <i class="bi ${isLocked ? 'bi-lock-fill' : mod.icon}"></i>
            </div>
        `;

        if (!isLocked) {
            card.addEventListener('click', () => startModule(mod));
        }
        modulesContainer.appendChild(card);
    });
}

function startModule(mod) {
    somClick.currentTime = 0;
    somClick.play();

    currentModule = mod;
    currentQuestionIndex = 0;
    acertosNoMiniProjeto = 0; // Zera os acertos ao iniciar a fase
    dashboard.classList.add('hidden');
    exerciseArea.classList.remove('hidden');

    // Se for o mini-projeto do Dashboard, mostra o canvas e zera o gráfico
    if (mod.isMiniProject) {
        canvasContainer.classList.remove('hidden');
        drawDashboardChart(0);
    } else {
        canvasContainer.classList.add('hidden');
    }

    loadQuestion();
}

// ==========================================
// LÓGICA DO CANVAS: GRÁFICO DE DASHBOARD
// ==========================================
function drawDashboardChart(acertos) {
    // Limpa o quadro
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Eixo X e Y do gráfico
    ctx.strokeStyle = '#2A2A2A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, 10);
    ctx.lineTo(30, 130);
    ctx.lineTo(280, 130);
    ctx.stroke();

    // Adiciona as barras de acordo com o número de acertos
    if (acertos >= 1) {
        ctx.fillStyle = '#F7DF1E'; // Amarelo JS
        ctx.fillRect(50, 60, 40, 70);
    }
    if (acertos >= 2) {
        ctx.fillStyle = '#111111'; // Preto
        ctx.fillRect(110, 30, 40, 100);
    }
    if (acertos >= 3) {
        ctx.fillStyle = '#28a745'; // Verde
        ctx.fillRect(170, 80, 40, 50);
    }
}
// ==========================================

function loadQuestion() {
    selectedOptionIndex = null;
    btnVerify.textContent = "Verificar";
    btnVerify.disabled = true;

    // Esconde o painel de feedback ao carregar a pergunta
    feedbackPanel.classList.add('hidden');
    feedbackPanel.classList.remove('success', 'error');

    // Atualiza a barra de progresso
    const progress = (currentQuestionIndex / currentModule.questions.length) * 100;
    progressBar.style.width = `${progress}%`;

    const question = currentModule.questions[currentQuestionIndex];
    questionContainer.innerHTML = `<h2>${question.text}</h2>`;

    optionsContainer.innerHTML = '';
    question.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => selectOption(index, btn));
        optionsContainer.appendChild(btn);
    });
}

function selectOption(index, btnElement) {
    selectedOptionIndex = index;

    somClick.currentTime = 0;
    somClick.play();
    // Remove a marcação de todas as outras opções
    document.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
    btnElement.classList.add('selected');

    // Libera o botão de verificar
    btnVerify.disabled = false;
}

btnVerify.addEventListener('click', async () => {
    const optionsButtons = document.querySelectorAll('.option-btn');

    // Se o botão estiver como "Continuar", ele avança para a próxima tela
    if (btnVerify.textContent === "Continuar") {
        currentQuestionIndex++;
        if (currentQuestionIndex < currentModule.questions.length) {
            loadQuestion();
        } else {
            finishModule();
        }
        return;
    }

    // ==========================================
    // Lógica ao clicar em "Verificar" (Comunicação com o Back-end)
    // ==========================================

    // Mostra pro usuário que está carregando (evita duplo clique)
    btnVerify.textContent = "Verificando...";
    btnVerify.disabled = true;
    optionsButtons.forEach(btn => btn.style.pointerEvents = 'none');

    try {
        // Envia os dados para a nossa API no servidor Vercel
        const response = await fetch('/api/verificar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                moduloId: currentModule.id,
                questionIndex: currentQuestionIndex,
                selectedOption: selectedOptionIndex
            })
        });

        const resultado = await response.json();

        feedbackPanel.classList.remove('hidden', 'success', 'error');

        // Usa a resposta do servidor para saber se acertou
        if (resultado.acertou) {
            if (typeof somAcerto !== 'undefined') { somAcerto.currentTime = 0; somAcerto.play(); }

            optionsButtons[selectedOptionIndex].classList.add('correct');
            userData.xp += 25;

            feedbackPanel.classList.add('success');
            feedbackTitle.innerHTML = '<i class="bi bi-check-circle-fill"></i> Mandou bem!';
            feedbackText.textContent = resultado.explanation;

            if (currentModule.isMiniProject) {
                acertosNoMiniProjeto++;
                drawDashboardChart(acertosNoMiniProjeto);
            }
        } else {
            if (typeof somErro !== 'undefined') { somErro.currentTime = 0; somErro.play(); }

            optionsButtons[selectedOptionIndex].classList.add('wrong');
            // O servidor nos diz qual era a correta para mostrarmos ao aluno
            optionsButtons[resultado.correctAnswer].classList.add('correct');

            feedbackPanel.classList.add('error');
            feedbackTitle.innerHTML = '<i class="bi bi-x-circle-fill"></i> Ops, não foi dessa vez.';
            feedbackText.textContent = resultado.explanation;
        }

    } catch (error) {
        console.error("Erro na validação:", error);
        alert("Erro ao se comunicar com o servidor.");
    }

    btnVerify.textContent = "Continuar";
    btnVerify.disabled = false;
});

function finishModule() {
    // 1. Salva o progresso
    if (!userData.completedModules.includes(currentModule.id)) {
        userData.completedModules.push(currentModule.id);
    }
    saveProgress();

    // 2. Dispara o som de vitória
    somCompleted.currentTime = 0;
    somCompleted.play();

    // 3. Oculta as perguntas e exibe a tela de vitória
    exerciseBox.classList.add('hidden');
    completedModuleName.textContent = currentModule.title;
    completionScreen.classList.remove('hidden');
}

// Botão da tela de vitória para voltar ao mapa
btnReturnDashboard.addEventListener('click', () => {
    somClick.currentTime = 0;
    somClick.play();
    closeExercise();
    renderModules(); // Re-renderiza para desbloquear o próximo módulo
});

function closeExercise() {
    somClick.currentTime = 0;
    somClick.play();
    dashboard.classList.remove('hidden');
    exerciseArea.classList.add('hidden');
    exerciseBox.classList.remove('hidden');
    completionScreen.classList.add('hidden');
}

// Fechar no "X"
btnCloseExercise.addEventListener('click', closeExercise);

// Executa a aplicação
init();



/* playground */

const playgroundChallenges = [
    {
        id: "map-1",
        title: "Dobre os Valores com .map()",
        description: "Use o método .map() para criar um novo array onde cada número seja multiplicado por 2.",
        hint: "Retorne array.map(num => num * 2);",
        setup: function () {
            this.initialArray = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10) + 1);
            this.expectedResult = this.initialArray.map(x => x * 2);
        }
    },
    {
        id: "filter-1",
        title: "Filtre os Pares com .filter()",
        description: "Use o método .filter() para criar um novo array contendo apenas os números pares.",
        hint: "Retorne array.filter(num => num % 2 === 0);",
        setup: function () {
            this.initialArray = Array.from({ length: 6 }, () => Math.floor(Math.random() * 20) + 1);
            this.expectedResult = this.initialArray.filter(x => x % 2 === 0);
        }
    },
    {
        id: "reduce-1",
        title: "Soma Total com .reduce()",
        description: "Use o método .reduce() para somar todos os números do array e retornar o total.",
        hint: "Retorne array.reduce((acc, curr) => acc + curr, 0);",
        setup: function () {
            this.initialArray = Array.from({ length: 4 }, () => Math.floor(Math.random() * 5 + 1) * 10);
            this.expectedResult = this.initialArray.reduce((acc, curr) => acc + curr, 0);
        }
    },
    {
        id: "push-1",
        title: "Adicionar item com .push()",
        description: "Adicione o número 99 ao final do array.",
        hint: "Na linha 1 digite: array.push(99); Na linha 2 digite: return array;",
        setup: function () {
            this.initialArray = Array.from({ length: 3 }, () => Math.floor(Math.random() * 10));
            this.expectedResult = [...this.initialArray, 99];
        }
    },
    {
        id: "pop-1",
        title: "Remover último com .pop()",
        description: "Remova o último elemento do array.",
        hint: "Na linha 1 digite: array.pop(); Na linha 2 digite: return array;",
        setup: function () {
            this.initialArray = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10));
            const arr = [...this.initialArray];
            arr.pop();
            this.expectedResult = arr;
        }
    },
    {
        id: "shift-1",
        title: "Remover primeiro com .shift()",
        description: "Remova o primeiro elemento do array.",
        hint: "Na linha 1 digite: array.shift(); Na linha 2 digite: return array;",
        setup: function () {
            this.initialArray = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10));
            const arr = [...this.initialArray];
            arr.shift();
            this.expectedResult = arr;
        }
    },
    {
        id: "length-1",
        title: "Tamanho do Array (.length)",
        description: "A propriedade .length não é um método (não usa parênteses). Retorne o tamanho total deste array.",
        hint: "Retorne array.length;",
        setup: function () {
            const randomSize = Math.floor(Math.random() * 5) + 3;
            this.initialArray = Array.from({ length: randomSize }, () => 0);
            this.expectedResult = this.initialArray.length;
        }
    },
    {
        id: "sort-1",
        title: "Organizar com .sort()",
        description: "Retorne o array organizado em ordem crescente.",
        hint: "Para ordenar números perfeitamente, retorne array.sort((a, b) => a - b);",
        setup: function () {
            this.initialArray = Array.from({ length: 5 }, () => Math.floor(Math.random() * 100));
            this.expectedResult = [...this.initialArray].sort((a, b) => a - b);
        }
    },
    {
        id: "every-1",
        title: "Teste absoluto com .every()",
        description: "Verifique se TODOS os números do array são maiores que 10. Retorna true ou false.",
        hint: "Retorne array.every(num => num > 10);",
        setup: function () {
            this.initialArray = Array.from({ length: 4 }, () => Math.floor(Math.random() * 20) + 5);
            this.expectedResult = this.initialArray.every(x => x > 10);
        }
    },
    {
        id: "some-1",
        title: "Teste parcial com .some()",
        description: "Verifique se PELO MENOS UM número do array é maior que 50. Retorna true ou false.",
        hint: "Retorne array.some(num => num > 50);",
        setup: function () {
            this.initialArray = Array.from({ length: 4 }, () => Math.floor(Math.random() * 100));
            this.expectedResult = this.initialArray.some(x => x > 50);
        }
    },
    {
        id: "find-1",
        title: "Encontrar item com .find()",
        description: "Retorne o PRIMEIRO número do array que seja maior que 20.",
        hint: "Retorne array.find(num => num > 20);",
        setup: function () {
            this.initialArray = [10, 15, Math.floor(Math.random() * 30) + 21, 5, 40];
            this.expectedResult = this.initialArray.find(x => x > 20);
        }
    },
    {
        id: "findIndex-1",
        title: "Índice com .findIndex()",
        description: "Retorne a POSIÇÃO (índice) do primeiro número que seja maior que 20.",
        hint: "Retorne array.findIndex(num => num > 20);",
        setup: function () {
            this.initialArray = [10, 15, Math.floor(Math.random() * 30) + 21, 5, 40];
            this.expectedResult = this.initialArray.findIndex(x => x > 20);
        }
    },
    {
        id: "includes-1",
        title: "Contém item? (.includes)",
        description: "Verifique se o número 5 existe dentro deste array. Retorne o boolean.",
        hint: "Retorne array.includes(5);",
        setup: function () {
            this.initialArray = [1, 2, 8, Math.random() > 0.5 ? 5 : 9];
            this.expectedResult = this.initialArray.includes(5);
        }
    },
    {
        id: "concat-1",
        title: "Juntar com .concat()",
        description: "Use .concat() para juntar o array atual com um novo array contendo os números [7, 8, 9].",
        hint: "Retorne array.concat([7, 8, 9]);",
        setup: function () {
            this.initialArray = [1, 2, 3];
            this.expectedResult = this.initialArray.concat([7, 8, 9]);
        }
    },
    {
        id: "join-1",
        title: "Transformar em String (.join)",
        description: "Junte todos os itens do array em um único texto, separados por um traço '-'.",
        hint: "Retorne array.join('-');",
        setup: function () {
            this.initialArray = ["HTML", "CSS", "JS"];
            this.expectedResult = this.initialArray.join('-');
        }
    },
    {
        id: "slice-1",
        title: "Fatiar com .slice()",
        description: "Retorne um novo array pegando apenas os dois primeiros itens do array original.",
        hint: "Retorne array.slice(0, 2); (corta do índice 0 até o índice 2, sem incluir o 2).",
        setup: function () {
            this.initialArray = ["Maçã", "Banana", "Pera", "Uva"];
            this.expectedResult = this.initialArray.slice(0, 2);
        }
    },
    {
        id: "splice-1",
        title: "Remover no meio (.splice)",
        description: "Remova exatamente 1 item a partir da posição (índice) 1. Retorne o array atualizado.",
        hint: "Na linha 1: array.splice(1, 1); Na linha 2: return array;",
        setup: function () {
            this.initialArray = ["Maçã", "Laranja", "Banana"];
            const arr = [...this.initialArray];
            arr.splice(1, 1);
            this.expectedResult = arr;
        }
    },
    {
        id: "fill-1",
        title: "Preencher com .fill()",
        description: "Substitua todos os itens do array pelo número 0 e retorne o array.",
        hint: "Retorne array.fill(0);",
        setup: function () {
            this.initialArray = [1, 2, 3, 4];
            this.expectedResult = [...this.initialArray].fill(0);
        }
    },
    {
        id: "delete-1",
        title: "Operador delete",
        description: "Deleções com 'delete' deixam um buraco (undefined). Delete o item da posição 0 e retorne o array.",
        hint: "Na linha 1: delete array[0]; Na linha 2: return array;",
        setup: function () {
            this.initialArray = ["React", "Vue", "Angular"];
            const arr = [...this.initialArray];
            delete arr[0];
            this.expectedResult = arr;
        }
    },
    // --- MÉTODOS DE STRING ---
    {
        id: "toUpperCase-1",
        title: "Maiúsculas com .toUpperCase()",
        description: "Converta todo o texto para letras maiúsculas.",
        isString: true,
        hint: "Retorne texto.toUpperCase();",
        setup: function () {
            const palavras = ["javascript", "frontend", "fullstack", "programação"];
            this.initialString = palavras[Math.floor(Math.random() * palavras.length)];
            this.expectedResult = this.initialString.toUpperCase();
        }
    },
    {
        id: "toLowerCase-1",
        title: "Minúsculas com .toLowerCase()",
        description: "Transforme o texto inteiro em letras minúsculas.",
        isString: true,
        hint: "Retorne texto.toLowerCase();",
        setup: function () {
            const palavras = ["DEvClub", "JaVaScRiPt", "VERCEL"];
            this.initialString = palavras[Math.floor(Math.random() * palavras.length)];
            this.expectedResult = this.initialString.toLowerCase();
        }
    },
    {
        id: "trim-1",
        title: "Limpar espaços com .trim()",
        description: "Remova os espaços em branco inúteis no início e no final do texto.",
        isString: true,
        hint: "Retorne texto.trim();",
        setup: function () {
            this.initialString = "   Olá Mundo!   ";
            this.expectedResult = this.initialString.trim();
        }
    },
    {
        id: "replace-1",
        title: "Substituir com .replace()",
        description: "Substitua a palavra 'difícil' por 'incrível' no texto.",
        isString: true,
        hint: "Retorne texto.replace('difícil', 'incrível');",
        setup: function () {
            this.initialString = "Aprender JS é difícil!";
            this.expectedResult = this.initialString.replace("difícil", "incrível");
        }
    },
    {
        id: "split-1",
        title: "Texto para Array (.split)",
        description: "Transforme a frase em um array de palavras, separando-as pelos espaços (' ').",
        isString: true,
        hint: "Retorne texto.split(' ');",
        setup: function () {
            this.initialString = "HTML CSS JavaScript";
            this.expectedResult = this.initialString.split(" ");
        }
    },
    {
        id: "substring-1",
        title: "Extrair com .substring()",
        description: "Extraia apenas os 4 primeiros caracteres do texto (posições 0 a 4).",
        isString: true,
        hint: "Retorne texto.substring(0, 4);",
        setup: function () {
            this.initialString = "Desenvolvedor";
            this.expectedResult = this.initialString.substring(0, 4);
        }
    },
    {
        id: "includes-str-1",
        title: "Buscar com .includes()",
        description: "Verifique se a frase contém a palavra 'Quest'. Lembre-se que diferencia maiúsculas de minúsculas!",
        isString: true,
        hint: "Retorne texto.includes('Quest');",
        setup: function () {
            const frases = ["Bem vindo ao JS Quest", "Estudando muito hoje"];
            this.initialString = frases[Math.floor(Math.random() * frases.length)];
            this.expectedResult = this.initialString.includes("Quest");
        }
    },
    // --- MÉTODOS DE DOM (VISUAL) ---
    {
        id: "dom-color-1",
        title: "Mudar Cor (.style.backgroundColor)",
        isDOM: true,
        paramName: "caixa",
        setup: function() {
            const cores = [
                { nome: "azul", valor: "blue" },
                { nome: "verde", valor: "green" },
                { nome: "roxo", valor: "purple" },
                { nome: "laranja", valor: "orange" }
            ];
            const corSorteada = cores[Math.floor(Math.random() * cores.length)];
            
            // A descrição e a dica mudam a cada sorteio!
            this.description = `Altere a cor de fundo da caixa para ${corSorteada.nome} ('${corSorteada.valor}').`;
            this.hint = `Digite: caixa.style.backgroundColor = '${corSorteada.valor}';`;
            
            this.targetHTML = `<div id="dom-box" style="width: 100px; height: 100px; background: #111; color: white; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-weight: bold; transition: background 0.3s;">Caixa</div>`;
            this.successMsg = `A caixa ficou ${corSorteada.nome}!`;
            this.validate = (el) => el.style.backgroundColor === corSorteada.valor;
        }
    },
    {
        id: "dom-text-1",
        title: "Alterar Texto (.textContent)",
        isDOM: true,
        paramName: "botao",
        setup: function() {
            const palavras = ["Aprovado!", "Concluído!", "Enviado!", "Sucesso!"];
            const sorteada = palavras[Math.floor(Math.random() * palavras.length)];
            
            this.description = `Mude o texto dentro do botão para '${sorteada}'.`;
            this.hint = `Digite: botao.textContent = '${sorteada}';`;
            
            this.targetHTML = `<button id="dom-btn" class="btn-primary" style="width: auto; pointer-events: none; transition: all 0.3s;">Clique Aqui</button>`;
            this.successMsg = `O texto mudou perfeitamente!`;
            this.validate = (el) => el.textContent === sorteada;
        }
    },
    {
        id: "dom-hide-1",
        title: "Esconder Elemento (.style.display)",
        isDOM: true,
        paramName: "quadrado",
        setup: function() {
            this.description = "Faça o quadrado desaparecer da tela usando a propriedade display CSS.";
            this.hint = "Digite: quadrado.style.display = 'none';";
            this.targetHTML = `<div id="dom-ghost" style="width: 100px; height: 100px; background: #F7DF1E; color: #111; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-weight: bold;">Fantasma</div>`;
            this.successMsg = "Você fez o elemento desaparecer!";
            this.validate = (el) => el.style.display === 'none';
        }
    },
    {
        id: "dom-border-1",
        title: "Arredondar Bordas (.style.borderRadius)",
        isDOM: true,
        paramName: "foto",
        setup: function() {
            // Sorteia um nome aleatório para gerar a imagem inicial
            const nomesIniciais = ["Aki", "Bandit", "Cali", "Loki", "Oreo", "Bella", "Duke", "Milo"];
            const sementeInicial = nomesIniciais[Math.floor(Math.random() * nomesIniciais.length)];
            
            const formatos = [
                { desc: "um círculo perfeito", valor: "50%" },
                { desc: "bordas levemente arredondadas", valor: "15px" }
            ];
            const sorteado = formatos[Math.floor(Math.random() * formatos.length)];
            
            this.description = `Transforme a foto em ${sorteado.desc} usando '${sorteado.valor}'.`;
            this.hint = `Digite: foto.style.borderRadius = '${sorteado.valor}';`;
            
            // A imagem inicial agora muda toda vez que o exercício é aberto!
            this.targetHTML = `<div id="dom-photo" style="width: 100px; height: 100px; background: url('https://api.dicebear.com/7.x/avataaars/svg?seed=${sementeInicial}') center/cover; border: 4px solid #fff; box-shadow: 0 4px 8px rgba(0,0,0,0.2); transition: border-radius 0.4s; background-color: #f0f0f0;"></div>`;
            this.successMsg = `A foto foi cortada para ${sorteado.valor}!`;
            this.validate = (el) => el.style.borderRadius === sorteado.valor;
        }
    },
    {
        id: "dom-font-1",
        title: "Tamanho da Fonte (.style.fontSize)",
        isDOM: true,
        paramName: "titulo",
        setup: function() {
            const tamanhos = ["24px", "32px", "40px", "50px"];
            const sorteado = tamanhos[Math.floor(Math.random() * tamanhos.length)];
            
            this.description = `Aumente o tamanho da fonte do título para '${sorteado}'.`;
            this.hint = `Digite: titulo.style.fontSize = '${sorteado}';`;
            
            this.targetHTML = `<h3 id="dom-title" style="font-size: 14px; margin: 0; transition: font-size 0.3s; color: #111;">Texto Flexível</h3>`;
            this.successMsg = `A fonte cresceu perfeitamente!`;
            this.validate = (el) => el.style.fontSize === sorteado;
        }
    },
    {
        id: "dom-class-1",
        title: "Adicionar Classe (.classList.add)",
        isDOM: true,
        paramName: "cartao",
        setup: function() {
            const classes = ["ativo", "destaque", "sucesso"];
            const sorteada = classes[Math.floor(Math.random() * classes.length)];
            
            this.description = `O HTML já possui classes CSS prontas escondidas. Adicione a classe '${sorteada}' ao cartão usando .classList.add()`;
            this.hint = `Digite: cartao.classList.add('${sorteada}');`;
            
            this.targetHTML = `<div id="dom-card" class="cartao-base" style="padding: 20px; background: #fff; border: 2px solid #ccc; border-radius: 8px; transition: all 0.3s;">Cartão Simples</div>`;
            this.successMsg = `A classe '${sorteada}' ativada com sucesso!`;
            this.validate = (el) => el.classList.contains(sorteada);
        }
    },
    {
        id: "dom-class-remove-1",
        title: "Remover Classe (.classList.remove)",
        isDOM: true,
        paramName: "modal",
        setup: function() {
            this.description = "O elemento possui a classe 'bloqueado' que o deixa cinza e apagado. Use .classList.remove() para tirar essa classe e revelar a cor original.";
            this.hint = "Digite: modal.classList.remove('bloqueado');";
            
            // Injetamos uma tag <style> junto para a classe 'bloqueado' existir visualmente no palco
            this.targetHTML = `
                <style>.bloqueado { opacity: 0.3; filter: grayscale(100%); }</style>
                <div id="dom-modal" class="bloqueado" style="width: 100px; height: 100px; background: #28a745; color: white; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-weight: bold; transition: all 0.5s;">Liberado</div>
            `;
            this.successMsg = "Classe removida, elemento liberado!";
            this.validate = (el) => !el.classList.contains('bloqueado');
        }
    },
    {
        id: "dom-value-1",
        title: "Preencher Input (.value)",
        isDOM: true,
        paramName: "campo",
        setup: function() {
            const tecnologias = ["React", "Node.js", "Firebase", "Vercel"];
            const sorteado = tecnologias[Math.floor(Math.random() * tecnologias.length)];
            
            this.description = `Preencha este campo de formulário com o valor '${sorteado}'.`;
            this.hint = `Digite: campo.value = '${sorteado}';`;
            
            this.targetHTML = `<input type="text" id="dom-input" placeholder="Digite algo..." style="padding: 10px; border-radius: 4px; border: 1px solid #ccc; font-size: 16px; color: #333;" readonly>`;
            this.successMsg = `Campo preenchido com ${sorteado}!`;
            this.validate = (el) => el.value === sorteado;
        }
    },
    {
        id: "dom-disable-1",
        title: "Desativar Botão (.disabled)",
        isDOM: true,
        paramName: "botao",
        setup: function() {
            this.description = "Para evitar que o usuário clique duas vezes e envie o formulário duplicado, desative o botão mudando a propriedade .disabled para true.";
            this.hint = "Digite: botao.disabled = true;";
            
            this.targetHTML = `<button id="dom-btn-submit" class="btn-primary" style="width: auto;">Enviar Dados</button>`;
            this.successMsg = "Botão desativado em segurança!";
            this.validate = (el) => el.disabled === true;
        }
    },
    {
        id: "dom-innerhtml-1",
        title: "Injetar HTML (.innerHTML)",
        isDOM: true,
        paramName: "caixa",
        setup: function() {
            this.description = "O .textContent só aceita textos puros. Use o .innerHTML para injetar a tag <strong>JS</strong> dentro da caixa.";
            this.hint = "Digite: caixa.innerHTML = '<strong>JS</strong>';";
            
            this.targetHTML = `<div id="dom-inner" style="padding: 20px; background: #fff; border: 2px dashed #333; border-radius: 8px; color: #333; text-align: center;">Vazio</div>`;
            this.successMsg = "Tag HTML interpretada e injetada com sucesso!";
            // Valida se ele colocou a tag certinha (os navegadores podem converter as tags para maiúsculo, então checamos ambas)
            this.validate = (el) => el.innerHTML === '<strong>JS</strong>' || el.innerHTML === '<STRONG>JS</STRONG>';
        }
    },
    {
        id: "dom-src-1",
        title: "Trocar Imagem (.src)",
        isDOM: true,
        paramName: "imagem",
        setup: function() {
            const avatares = ["Mia", "Felix", "Leo", "Bella", "Max", "Luna", "Charlie", "Lucy", "Buster"];
            
            // 1. Sorteia a imagem inicial
            const sementeInicial = avatares[Math.floor(Math.random() * avatares.length)];
            
            // 2. Filtra a lista para garantir que a imagem alvo seja DIFERENTE da inicial
            const avataresRestantes = avatares.filter(nome => nome !== sementeInicial);
            const sorteado = avataresRestantes[Math.floor(Math.random() * avataresRestantes.length)];
            
            const urlInicial = `https://api.dicebear.com/7.x/avataaars/svg?seed=${sementeInicial}`;
            const novaUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${sorteado}`;
            
            this.description = `A imagem atual é o avatar '${sementeInicial}'. Acesse a propriedade .src e mude a URL para carregar o avatar '${sorteado}': "${novaUrl}"`;
            this.hint = `Digite: imagem.src = '${novaUrl}';`;
            
            // Injeta a imagem inicial aleatória
            this.targetHTML = `<img id="dom-img" src="${urlInicial}" style="width: 100px; height: 100px; border-radius: 8px; background: #fff; border: 4px solid #F7DF1E; transition: all 0.3s;">`;
            this.successMsg = `Avatar atualizado de ${sementeInicial} para ${sorteado}!`;
            this.validate = (el) => el.src === novaUrl;
        }
    },
    {
        id: "dom-transform-1",
        title: "Girar Elemento (.style.transform)",
        isDOM: true,
        paramName: "seta",
        setup: function() {
            const direcoes = [
                { grau: "90deg", nome: "direita" },
                { grau: "180deg", nome: "baixo" },
                { grau: "270deg", nome: "esquerda" }
            ];
            const sorteado = direcoes[Math.floor(Math.random() * direcoes.length)];
            
            this.description = `Gire a seta para a ${sorteado.nome} aplicando 'rotate(${sorteado.grau})' na propriedade CSS transform.`;
            this.hint = `Digite: seta.style.transform = 'rotate(${sorteado.grau})';`;
            
            this.targetHTML = `<div id="dom-arrow" style="font-size: 50px; display: inline-block; transition: transform 0.4s ease-out;">⬆️</div>`;
            this.successMsg = `Seta girada para a ${sorteado.nome}!`;
            this.validate = (el) => el.style.transform.includes(sorteado.grau.replace('deg', '')); // O navegador tira o 'deg' às vezes ao renderizar
        }
    },
    {
        id: "dom-alt-1",
        title: "Texto Alternativo (.alt)",
        isDOM: true,
        paramName: "imagem",
        setup: function() {
            // Sorteia imagens e suas respectivas descrições de acessibilidade
            const opcoes = [
                { seed: "Coco", desc: "Cachorrinho fofo" },
                { seed: "Buster", desc: "Gato sorridente" },
                { seed: "Simba", desc: "Leãozinho estiloso" },
                { seed: "Toby", desc: "Programador focado" }
            ];
            const sorteado = opcoes[Math.floor(Math.random() * opcoes.length)];
            
            this.description = `Por questões de acessibilidade (leitores de tela), adicione a descrição '${sorteado.desc}' no atributo .alt desta imagem.`;
            this.hint = `Digite: imagem.alt = '${sorteado.desc}';`;
            
            this.targetHTML = `<img id="dom-img-alt" src="https://api.dicebear.com/7.x/avataaars/svg?seed=${sorteado.seed}" alt="" style="width: 100px; height: 100px; border-radius: 8px; background: #fff; border: 4px solid #ccc;">`;
            this.successMsg = `Acessibilidade garantida! Atributo alt preenchido com sucesso.`;
            this.validate = (el) => el.alt === sorteado.desc;
        }
    }  
];

const navJourney = document.getElementById('nav-journey');
const navPlayground = document.getElementById('nav-playground');
const playgroundArea = document.getElementById('playground-area');
const playgroundList = document.getElementById('playground-list');
const pgTitle = document.getElementById('pg-title');
const pgDesc = document.getElementById('pg-desc');
const pgArrayPreview = document.getElementById('pg-array-preview');

const btnRunCode = document.getElementById('btn-run-code');
const consoleResult = document.getElementById('console-result');

const domPreviewContainer = document.getElementById('dom-preview-container');
const pgDataPreview = document.querySelector('.pg-data-preview');

let currentChallenge = null;

//sistema de abas

navJourney.addEventListener('click', () => {
    somClick.currentTime = 0;
    somClick.play();
    navJourney.classList.add('active');
    navPlayground.classList.remove('active');
    dashboard.classList.remove('hidden');
    playgroundArea.classList.add('hidden');
    exerciseArea.classList.add('hidden');
});

navPlayground.addEventListener('click', () => {
    somClick.currentTime = 0;
    somClick.play();
    navPlayground.classList.add('active');
    navJourney.classList.remove('active');
    dashboard.classList.add('hidden');
    exerciseArea.classList.add('hidden');
    playgroundArea.classList.remove('hidden');
    initPlayground();
});


// Inicializa a lista lateral do Playground com categorias
function initPlayground() {
    const sidebar = document.querySelector('.playground-sidebar');
    sidebar.innerHTML = ''; // Limpa a barra lateral

    // Separa os desafios pelas suas propriedades
    const desafiosArray = playgroundChallenges.filter(c => !c.isString && !c.isDOM);
    const desafiosString = playgroundChallenges.filter(c => c.isString);
    const desafiosDOM = playgroundChallenges.filter(c => c.isDOM);

    // Função interna que constrói cada grupo na tela
    function criarCategoria(titulo, desafios) {
        if (desafios.length === 0) return;

        // Cria o título (h3)
        const h3 = document.createElement('h3');
        h3.textContent = titulo;
        // Adiciona um espaço extra no topo se não for a primeira categoria
        h3.style.marginTop = sidebar.children.length > 0 ? '25px' : '0';
        sidebar.appendChild(h3);

        // Cria a lista (ul)
        const ul = document.createElement('ul');
        ul.className = 'playground-list';

        // Preenche a lista com os botões
        desafios.forEach((challenge) => {
            const li = document.createElement('li');
            li.textContent = challenge.title;
            li.addEventListener('click', () => loadChallenge(challenge, li));
            ul.appendChild(li);
        });

        sidebar.appendChild(ul);
    }

    // Renderiza as categorias na ordem desejada
    criarCategoria('Métodos de Array', desafiosArray);
    criarCategoria('Métodos de String', desafiosString);
    criarCategoria('MÉTODOS DE DOM (VISUAL)', desafiosDOM);

    // Seleciona automaticamente o primeiro desafio da primeira lista ao abrir
    if (playgroundChallenges.length > 0) {
        const primeiroLi = sidebar.querySelector('li');
        // Pega o primeiro desafio do array geral (que será o map-1)
        loadChallenge(playgroundChallenges[0], primeiroLi);
    }
}

function loadChallenge(challenge, liElement) {
    currentChallenge = challenge;

    // GERA OS NÚMEROS/TEXTOS ALEATÓRIOS
    currentChallenge.setup();

    // Atualiza visual da lista
    document.querySelectorAll('.playground-list li').forEach(li => li.classList.remove('active'));
    liElement.classList.add('active');

    // Preenche cabeçalho
    pgTitle.textContent = challenge.title;
    pgDesc.textContent = challenge.description;
    //digas
    pgHintText.textContent = challenge.hint;
    pgHintBox.classList.add('hidden');

    pgTitle.textContent = challenge.title;
    pgDesc.textContent = challenge.description;
    pgHintText.textContent = challenge.hint;
    pgHintBox.classList.add('hidden');
    
    // NOVO: Alterna entre Modo Texto/Array e Modo DOM Visual
    if (challenge.isDOM) {
        pgDataPreview.classList.add('hidden');
        domPreviewContainer.classList.remove('hidden');
        domPreviewContainer.innerHTML = challenge.targetHTML; // Desenha o elemento na tela
    } else {
        domPreviewContainer.classList.add('hidden');
        pgDataPreview.classList.remove('hidden');
        
        const previewData = challenge.isString ? challenge.initialString : challenge.initialArray;
        document.getElementById('pg-data-label').textContent = challenge.isString ? 'Texto inicial: ' : 'Array inicial: ';
        pgArrayPreview.textContent = JSON.stringify(previewData);
    }

    // VERIFICA SE É STRING OU ARRAY PARA MUDAR O TEXTO DA TELA
    const previewData = challenge.isString ? challenge.initialString : challenge.initialArray;
    const rotulo = document.querySelector('.pg-data-preview strong');
    rotulo.textContent = challenge.isString ? 'Texto inicial: ' : 'Array inicial: ';

    pgArrayPreview.textContent = JSON.stringify(previewData);

    // Reseta editor
    if (editor) editor.setValue("");
    mobileCodeInput.value = "";
    consoleResult.textContent = "Aguardando execução...";
    consoleResult.className = "";
    btnRunCode.disabled = false;

    // Limpa ambos os editores
    if (editor) editor.setValue("");
    mobileCodeInput.value = "";

    // Atualiza o atalho dinâmico baseado no ID do desafio (ex: 'map-1' vira '.map()')
    if (dynamicShortcut) {
        const metodo = challenge.id.split('-')[0];
        // Não aplica para desafios genéricos como length ou delete
        if (metodo !== 'length' && metodo !== 'delete') {
            dynamicShortcut.textContent = `.${metodo}()`;
            dynamicShortcut.style.display = 'block';
        } else {
            dynamicShortcut.style.display = 'none';
        }
    }
}

// Lógica para abrir e fechar a dica
btnHint.addEventListener('click', () => {
    pgHintBox.classList.toggle('hidden');
    // Se quiser, adicione o som do clique aqui:
    if (typeof somClique !== 'undefined') { somClique.currentTime = 0; somClique.play(); }
});

// O Motor de Execução de Código
btnRunCode.addEventListener('click', () => {
    // Deteta se está no telemóvel ou no PC
    const isMobile = window.innerWidth <= 768;
    const userCode = isMobile ? mobileCodeInput.value : (typeof editor !== 'undefined' ? editor.getValue() : codeInput.value);

    try {
        // =====================================
        // MODO 1: MANIPULAÇÃO DE DOM (VISUAL)
        // =====================================
        if (currentChallenge.isDOM) {
            // Pega o elemento visual que está dentro do nosso "palco"
            const targetElement = domPreviewContainer.firstElementChild;
            
            // Define o nome da variável baseando-se na palavra-chave do ID do desafio
            const paramName = currentChallenge.paramName || 'elemento';
            
            // Cria a função nativa e passa o elemento HTML real para ela
            const execucao = new Function(paramName, userCode);
            execucao(targetElement); 
            
            // Verifica se o usuário conseguiu alterar o HTML corretamente
            if (currentChallenge.validate(targetElement)) {
                consoleResult.textContent = `> DOM Manipulado!\n\n✅ Sucesso: ${currentChallenge.successMsg}`;
                consoleResult.className = "console-success";
                if (typeof somCorrect !== 'undefined') { somCorrect.currentTime = 0; somCorrect.play(); }
            } else {
                consoleResult.textContent = `> Nenhuma mudança válida detectada.\n\n❌ Ops! O elemento não atingiu o estado visual esperado.`;
                consoleResult.className = "console-error";
                if (typeof somWrong !== 'undefined') { somWrong.currentTime = 0; somWrong.play(); }
            }
            return; // Encerra a função aqui para não rodar a lógica de array abaixo
        }

        // =====================================
        // MODO 2: ARRAYS E STRINGS (TEXTO)
        // =====================================
        const paramName = currentChallenge.isString ? 'texto' : 'array';
        const execucao = new Function(paramName, userCode);
        
        const dadoInicial = currentChallenge.isString 
            ? currentChallenge.initialString 
            : [...currentChallenge.initialArray];
            
        const resultadoUsuario = execucao(dadoInicial);

        const formatado = JSON.stringify(resultadoUsuario);
        const esperado = JSON.stringify(currentChallenge.expectedResult);

        if (formatado === esperado) {
            consoleResult.textContent = `> ${formatado}\n\n✅ Sucesso! O seu código retornou o resultado esperado.`;
            consoleResult.className = "console-success";
            if (typeof somCorrect !== 'undefined') { somCorrect.currentTime = 0; somCorrect.play(); }
        } else {
            consoleResult.textContent = `> Retornou: ${formatado}\n> Esperado: ${esperado}\n\n❌ Ops! O resultado está diferente do esperado.`;
            consoleResult.className = "console-error";
            if (typeof somWrong !== 'undefined') { somWrong.currentTime = 0; somWrong.play(); }
        }
    } catch (erro) {
        consoleResult.textContent = `❌ Erro de Sintaxe ou Execução: ${erro.message}`;
        consoleResult.className = "console-error";
        if (typeof somWrong !== 'undefined') { somWrong.currentTime = 0; somWrong.play(); }
    }
});

// Lógica para injetar o texto dos atalhos no textarea mobile
shortcutBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault(); // Evita que a tela suba ao clicar
        if(typeof somClique !== 'undefined') { somClique.currentTime = 0; somClique.play(); }

        const textToInsert = btn.textContent;
        const startPos = mobileCodeInput.selectionStart;
        const endPos = mobileCodeInput.selectionEnd;
        const currentText = mobileCodeInput.value;

        // Insere o atalho exatamente onde o cursor está
        mobileCodeInput.value = currentText.substring(0, startPos) + textToInsert + currentText.substring(endPos);

        // Devolve o foco para o textarea e move o cursor para logo após o texto inserido
        mobileCodeInput.focus();
        mobileCodeInput.selectionStart = startPos + textToInsert.length;
        mobileCodeInput.selectionEnd = startPos + textToInsert.length;
    });
});
