const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(__dirname, 'memory.txt');
const CSV_PATH = path.join(__dirname, 'input_data.csv');

const POPULATION_SIZE = 80;
const GENERATIONS_PER_RUN = 40;
const MUTATION_RATE = 0.04;

// Función para leer y parsear el archivo CSV de forma dinámica
function loadCSVData() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error('input_data.csv not found! Please provide a valid dataset.');
  }
  const fileContent = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = fileContent.trim().split('\n');
  
  if (lines.length < 2) {
    throw new Error('input_data.csv is empty or missing data rows.');
  }

  // Extraer las cabeceras de la primera línea
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const items = [];

  // Parsear las filas restantes de forma dinámica
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    
    const item = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const val = parts[j] !== undefined ? parts[j].trim() : '';
      
      if (header === 'id' || header === 'name') {
        item[header] = val;
      } else {
        item[header] = parseFloat(val) || 0;
      }
    }
    items.push(item);
  }
  return { items, headers };
}

const dataset = loadCSVData();
const ITEMS = dataset.items;
const HEADERS = dataset.headers;

// Detectar automáticamente qué recursos deben controlarse (todas las columnas numéricas excepto 'value')
const RESOURCE_KEYS = HEADERS.filter(h => h !== 'id' && h !== 'name' && h !== 'value');

// 1. Factor de proporción dinámico según el tamaño del CSV (se adapta entre 0.3 y 0.7)
const dynamicFactor = Math.max(0.3, Math.min(0.7, 0.7 - (ITEMS.length * 0.005)));

// 2. Generar límites automáticos basados en la media aritmética y el factor dinámico
const LIMITS = {};
RESOURCE_KEYS.forEach(key => {
  const totalSum = ITEMS.reduce((acc, item) => acc + (item[key] || 0), 0);
  const arithmeticMean = totalSum / ITEMS.length;
  LIMITS[key] = Math.round(arithmeticMean * (ITEMS.length * dynamicFactor));
});

// Cargar o inicializar la memoria persistente
function loadMemory() {
  if (!fs.existsSync(MEMORY_PATH)) {
    console.log('[AI] Initializing new evolutionary population from dynamic CSV dataset...');
    const initialPopulation = Array.from({ length: POPULATION_SIZE }, () =>
      ITEMS.map(() => (Math.random() > 0.4 ? 1 : 0))
    );
    return { 
      generation: 0, 
      bestScore: 0, 
      bestResourcesUsed: {},
      bestCombination: [], 
      population: initialPopulation 
    };
  }
  return JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
}

function saveMemory(data) {
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Función de evaluación con penalización progresiva (Soft Constraints)
function evaluate(individual) {
  let totals = {};
  RESOURCE_KEYS.forEach(key => { totals[key] = 0; });
  let totalValue = 0;

  for (let i = 0; i < individual.length; i++) {
    if (individual[i] === 1) {
      RESOURCE_KEYS.forEach(key => {
        totals[key] += ITEMS[i][key] || 0;
      });
      totalValue += ITEMS[i].value || 0;
    }
  }

  let penaltyMultiplier = 1.0;
  let isValid = true;

  // Comprobar si se viola algún límite y aplicar penalización proporcional al exceso
  for (const key of RESOURCE_KEYS) {
    if (LIMITS[key] !== undefined && totals[key] > LIMITS[key]) {
      isValid = false;
      const excess = totals[key] - LIMITS[key];
      const excessRatio = excess / LIMITS[key];
      // Cuanto más se pase del límite, mayor será el factor de reducción de puntuación
      penaltyMultiplier -= excessRatio * 2.0; 
    }
  }

  // Asegurar que la penalización no baje del 0 absoluto
  penaltyMultiplier = Math.max(0, penaltyMultiplier);
  const finalScore = Math.round(totalValue * penaltyMultiplier);

  return { score: finalScore, resourcesUsed: totals, valid: isValid && penaltyMultiplier > 0 };
}

// Selección por Torneo binario
function tournamentSelection(population, scores) {
  const k = 3;
  let bestIdx = Math.floor(Math.random() * population.length);
  for (let i = 1; i < k; i++) {
    const idx = Math.floor(Math.random() * population.length);
    if (scores[idx] > scores[bestIdx]) {
      bestIdx = idx;
    }
  }
  return population[bestIdx];
}

function crossover(parent1, parent2) {
  const point = Math.floor(Math.random() * parent1.length);
  return [...parent1.slice(0, point), ...parent2.slice(point)];
}

function mutate(individual) {
  return individual.map(gene => (Math.random() < MUTATION_RATE ? 1 - gene : gene));
}

// Ciclo principal de evolución autónoma
function runEvolution() {
  let memory = loadMemory();
  let population = memory.population;

  console.log(`[AI] Resumed at Gen ${memory.generation}. Best Score from CSV dataset: ${memory.bestScore}`);
  console.log(`[AI] Dynamic Resources Tracked: [${RESOURCE_KEYS.join(', ')}]`);
  console.log(`[AI] Dataset Size: ${ITEMS.length} items | Auto-Calculated Dynamic Factor: ${dynamicFactor.toFixed(3)}`);
  console.log(`[AI] Mean-Based Auto-Calculated Limits:`, LIMITS);

  for (let gen = 0; gen < GENERATIONS_PER_RUN; gen++) {
    memory.generation++;
    
    const evaluationResults = population.map(evaluate);
    const scores = evaluationResults.map(res => res.score);

    for (let i = 0; i < population.length; i++) {
      if (scores[i] > memory.bestScore) {
        memory.bestScore = scores[i];
        memory.bestResourcesUsed = evaluationResults[i].resourcesUsed;
        memory.bestCombination = [...population[i]];
        
        const usageLog = Object.entries(memory.bestResourcesUsed)
          .map(([k, v]) => `${k}: ${v}/${LIMITS[k]}`)
          .join(' | ');

        console.log(`[AI] Gen ${memory.generation}: 🚀 New Record! Value: ${memory.bestScore} | ${usageLog}`);
      }
    }

    let newPopulation = [];
    const sortedIndices = scores.map((s, idx) => ({ s, idx })).sort((a, b) => b.s - a.s);
    newPopulation.push([...population[sortedIndices[0].idx]]); // Elitismo

    while (newPopulation.length < POPULATION_SIZE) {
      const p1 = tournamentSelection(population, scores);
      const p2 = tournamentSelection(population, scores);
      let child = crossover(p1, p2);
      child = mutate(child);
      newPopulation.push(child);
    }

    population = newPopulation;
  }

  memory.population = population;
  saveMemory(memory);
  console.log(`[AI] Batch finished. Generation reached: ${memory.generation}. Historic Best Score: ${memory.bestScore}`);
}

runEvolution();
