// Registro do Service Worker (PWA)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado com sucesso!', reg))
            .catch(err => console.error('Erro ao registrar Service Worker:', err));
    });
}

// Gerenciamento de Estado
let userData = JSON.parse(localStorage.getItem('jsQuestData')) || {
    xp: 0,
    completedModules: []
};

let curriculum = [];
let currentModule = null;
let currentQuestionIndex = 0;
let selectedOptionIndex = null;
let acertosNoMiniProjeto = 0;

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
    localStorage.setItem('jsQuestData', JSON.stringify(userData));
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
        setup: function() {
            this.initialArray = Array.from({length: 5}, () => Math.floor(Math.random() * 10) + 1);
            this.expectedResult = this.initialArray.map(x => x * 2);
        }
    },
    {
        id: "filter-1",
        title: "Filtre os Pares com .filter()",
        description: "Use o método .filter() para criar um novo array contendo apenas os números pares.",
        setup: function() {
            this.initialArray = Array.from({length: 6}, () => Math.floor(Math.random() * 20) + 1);
            this.expectedResult = this.initialArray.filter(x => x % 2 === 0);
        }
    },
    {
        id: "reduce-1",
        title: "Soma Total com .reduce()",
        description: "Use o método .reduce() para somar todos os números do array e retornar o total.",
        setup: function() {
            this.initialArray = Array.from({length: 4}, () => Math.floor(Math.random() * 5 + 1) * 10);
            this.expectedResult = this.initialArray.reduce((acc, curr) => acc + curr, 0);
        }
    },
    {
        id: "push-1",
        title: "Adicionar item com .push()",
        description: "Adicione o número 99 ao final do array. (Dica: digite array.push(99); e na linha de baixo return array;)",
        setup: function() {
            this.initialArray = Array.from({length: 3}, () => Math.floor(Math.random() * 10));
            this.expectedResult = [...this.initialArray, 99];
        }
    },
    {
        id: "pop-1",
        title: "Remover último com .pop()",
        description: "Remova o último elemento do array. (Dica: use array.pop(); e depois retorne o array)",
        setup: function() {
            this.initialArray = Array.from({length: 4}, () => Math.floor(Math.random() * 10));
            const arr = [...this.initialArray];
            arr.pop();
            this.expectedResult = arr;
        }
    },
    {
        id: "shift-1",
        title: "Remover primeiro com .shift()",
        description: "Remova o primeiro elemento do array. (Dica: use array.shift(); e depois retorne o array)",
        setup: function() {
            this.initialArray = Array.from({length: 4}, () => Math.floor(Math.random() * 10));
            const arr = [...this.initialArray];
            arr.shift();
            this.expectedResult = arr;
        }
    },
    {
        id: "length-1",
        title: "Tamanho do Array (.length)",
        description: "A propriedade .length não é um método (não usa parênteses). Retorne o tamanho total deste array.",
        setup: function() {
            const randomSize = Math.floor(Math.random() * 5) + 3;
            this.initialArray = Array.from({length: randomSize}, () => 0);
            this.expectedResult = this.initialArray.length;
        }
    },
    {
        id: "sort-1",
        title: "Organizar com .sort()",
        description: "Retorne o array organizado em ordem crescente. (Dica: para números, use array.sort((a,b) => a - b))",
        setup: function() {
            this.initialArray = Array.from({length: 5}, () => Math.floor(Math.random() * 100));
            this.expectedResult = [...this.initialArray].sort((a, b) => a - b);
        }
    },
    {
        id: "every-1",
        title: "Teste absoluto com .every()",
        description: "Verifique se TODOS os números do array são maiores que 10. Retorna true ou false.",
        setup: function() {
            this.initialArray = Array.from({length: 4}, () => Math.floor(Math.random() * 20) + 5);
            this.expectedResult = this.initialArray.every(x => x > 10);
        }
    },
    {
        id: "some-1",
        title: "Teste parcial com .some()",
        description: "Verifique se PELO MENOS UM número do array é maior que 50. Retorna true ou false.",
        setup: function() {
            this.initialArray = Array.from({length: 4}, () => Math.floor(Math.random() * 100));
            this.expectedResult = this.initialArray.some(x => x > 50);
        }
    },
    {
        id: "find-1",
        title: "Encontrar item com .find()",
        description: "Retorne o PRIMEIRO número do array que seja maior que 20.",
        setup: function() {
            this.initialArray = [10, 15, Math.floor(Math.random() * 30) + 21, 5, 40];
            this.expectedResult = this.initialArray.find(x => x > 20);
        }
    },
    {
        id: "findIndex-1",
        title: "Índice com .findIndex()",
        description: "Retorne a POSIÇÃO (índice) do primeiro número que seja maior que 20.",
        setup: function() {
            this.initialArray = [10, 15, Math.floor(Math.random() * 30) + 21, 5, 40];
            this.expectedResult = this.initialArray.findIndex(x => x > 20);
        }
    },
    {
        id: "includes-1",
        title: "Contém item? (.includes)",
        description: "Verifique se o número 5 existe dentro deste array. Retorne o boolean.",
        setup: function() {
            this.initialArray = [1, 2, 8, Math.random() > 0.5 ? 5 : 9];
            this.expectedResult = this.initialArray.includes(5);
        }
    },
    {
        id: "concat-1",
        title: "Juntar com .concat()",
        description: "Use .concat() para juntar o array atual com um novo array contendo os números [7, 8, 9].",
        setup: function() {
            this.initialArray = [1, 2, 3];
            this.expectedResult = this.initialArray.concat([7, 8, 9]);
        }
    },
    {
        id: "join-1",
        title: "Transformar em String (.join)",
        description: "Junte todos os itens do array em um único texto, separados por um traço '-'.",
        setup: function() {
            this.initialArray = ["HTML", "CSS", "JS"];
            this.expectedResult = this.initialArray.join('-');
        }
    },
    {
        id: "slice-1",
        title: "Fatiar com .slice()",
        description: "Retorne um novo array pegando apenas os dois primeiros itens do array original.",
        setup: function() {
            this.initialArray = ["Maçã", "Banana", "Pera", "Uva"];
            this.expectedResult = this.initialArray.slice(0, 2);
        }
    },
    {
        id: "splice-1",
        title: "Remover no meio (.splice)",
        description: "Remova exatamente 1 item a partir da posição (índice) 1. Retorne o array atualizado.",
        setup: function() {
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
        setup: function() {
            this.initialArray = [1, 2, 3, 4];
            this.expectedResult = [...this.initialArray].fill(0);
        }
    },
    {
        id: "delete-1",
        title: "Operador delete",
        description: "Deleções com 'delete' deixam um buraco (undefined). Delete o item da posição 0 e retorne o array.",
        setup: function() {
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
        description: "Converta todo o texto para letras maiúsculas. (Dica: use return texto.toUpperCase())",
        isString: true,
        setup: function() {
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
        setup: function() {
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
        setup: function() {
            this.initialString = "   Olá Mundo!   ";
            this.expectedResult = this.initialString.trim();
        }
    },
    {
        id: "replace-1",
        title: "Substituir com .replace()",
        description: "Substitua a palavra 'difícil' por 'incrível' no texto.",
        isString: true,
        setup: function() {
            this.initialString = "Aprender JS é difícil!";
            this.expectedResult = this.initialString.replace("difícil", "incrível");
        }
    },
    {
        id: "split-1",
        title: "Texto para Array (.split)",
        description: "Transforme a frase em um array de palavras, separando-as pelos espaços (' ').",
        isString: true,
        setup: function() {
            this.initialString = "HTML CSS JavaScript";
            this.expectedResult = this.initialString.split(" ");
        }
    },
    {
        id: "substring-1",
        title: "Extrair com .substring()",
        description: "Extraia apenas os 4 primeiros caracteres do texto (posições 0 a 4).",
        isString: true,
        setup: function() {
            this.initialString = "Desenvolvedor";
            this.expectedResult = this.initialString.substring(0, 4);
        }
    },
    {
        id: "includes-str-1",
        title: "Buscar com .includes()",
        description: "Verifique se a frase contém a palavra 'Quest'. Lembre-se que diferencia maiúsculas de minúsculas!",
        isString: true,
        setup: function() {
            const frases = ["Bem vindo ao JS Quest", "Estudando muito hoje"];
            this.initialString = frases[Math.floor(Math.random() * frases.length)];
            this.expectedResult = this.initialString.includes("Quest");
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
const codeInput = document.getElementById('code-input');
const btnRunCode = document.getElementById('btn-run-code');
const consoleResult = document.getElementById('console-result');

let currentChallenge = null;

//sistema de abas

navJourney.addEventListener('click', () => {
    navJourney.classList.add('active');
    navPlayground.classList.remove('active');
    dashboard.classList.remove('hidden');
    playgroundArea.classList.add('hidden');
    exerciseArea.classList.add('hidden');
});

navPlayground.addEventListener('click', () => {
    navPlayground.classList.add('active');
    navJourney.classList.remove('active');
    dashboard.classList.add('hidden');
    exerciseArea.classList.add('hidden');
    playgroundArea.classList.remove('hidden');
    initPlayground();
});


function initPlayground() {
    playgroundList.innerHTML = '';
    playgroundChallenges.forEach((challenge, index) => {
        const li = document.createElement('li');
        li.textContent = challenge.title;
        li.addEventListener('click', () => loadChallenge(challenge, li));
        playgroundList.appendChild(li);

        if (index === 0) loadChallenge(challenge, li);
    });
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
    
    // VERIFICA SE É STRING OU ARRAY PARA MUDAR O TEXTO DA TELA
    const previewData = challenge.isString ? challenge.initialString : challenge.initialArray;
    const rotulo = document.querySelector('.pg-data-preview strong');
    rotulo.textContent = challenge.isString ? 'Texto inicial: ' : 'Array inicial: ';
    
    pgArrayPreview.textContent = JSON.stringify(previewData);
    
    // Reseta editor
    codeInput.value = "";
    consoleResult.textContent = "Aguardando execução...";
    consoleResult.className = "";
    btnRunCode.disabled = false;
}

btnRunCode.addEventListener('click', () => {
    const userCode = codeInput.value;

    try {
        // 1. Define se a variável vai se chamar 'texto' ou 'array'
        const paramName = currentChallenge.isString ? 'texto' : 'array';
        const execucao = new Function(paramName, userCode);
        
        // 2. Pega o dado correto (a string original ou a cópia do array)
        const dadoInicial = currentChallenge.isString 
            ? currentChallenge.initialString 
            : [...currentChallenge.initialArray];
            
        // Executa a função do usuário
        const resultadoUsuario = execucao(dadoInicial);

        // Formata a saída no console
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
        // Captura erros de sintaxe digitados pelo usuário
        consoleResult.textContent = `❌ Erro de Sintaxe: ${erro.message}`;
        consoleResult.className = "console-error";
        if (typeof somWrong !== 'undefined') { somWrong.currentTime = 0; somWrong.play(); }
    }
});
