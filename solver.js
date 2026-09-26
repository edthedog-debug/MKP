const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(__dirname, 'memory.txt');
const CSV_PATH = path.join(__dirname, 'input_data.csv');

const POPULATION_SIZE = 80;
const GENERATIONS_PER_RUN = 40;
const MUTATION_RATE = 0.1; // Ligeramente mayor en continuo para explorar mejor el espacio

// ==========================================
// CONFIGURACIÓN HÍBRIDA DE LÍMITES DE NEGOCIO
// ==========================================
const HARD_LIMITS = {
  // budget: 50000,
  weight: 300
};

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

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const items = [];

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

const RESOURCE_KEYS = HEADERS.filter(h => h !== 'id' && h !== 'name' && h !== 'value');

const dynamicFactor = Math.max(0.3, Math.min(0.7, 0.7 - (ITEMS.length * 0.005)));

const LIMITS = {};
RESOURCE_KEYS.forEach(key => {
  if (HARD_LIMITS[key] !== undefined) {
    LIMITS[key] = HARD_LIMITS[key];
  } else {
    const totalSum = ITEMS.reduce((acc, item) => acc + (item[key] || 0), 0);
    const arithmeticMean = totalSum / ITEMS.length;
    LIMITS[key] = Math.round(arithmeticMean * (ITEMS.length * dynamicFactor));
  }
});

// Función clave: Asegura que todos los pesos sumen exactamente 1.0 (100%)
function normalizeWeights(weights) {
  const sum = weights.reduce((acc, val) => acc + val, 0);
  if (sum === 0) {
    // Si todos son cero por azar, repartir equitativamente
    const equalVal = 1 / weights.length;
    return weights.map(() => equalVal);
  }
  return weights.map(val => val / sum);
}

// Cargar o inicializar la memoria persistente con pesos continuos normalizados
function loadMemory() {
  if (!fs.existsSync(MEMORY_PATH)) {
    console.log('[AI] Initializing new continuous evolutionary population of weights...');
    const initialPopulation = Array.from({ length: POPULATION_SIZE }, () => {
      const rawWeights = ITEMS.map(() => Math.random());
      return normalizeWeights(rawWeights);
    });
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

// Función de evaluación adaptada a porcentajes/pesos continuos
function evaluate(individual) {
  let totals = {};
  RESOURCE_KEYS.forEach(key => { totals[key] = 0; });
  let totalValue = 0;

  // En modelo continuo, el peso determina la proporción de cada recurso y valor aportado
  for (let i = 0; i < individual.length; i++) {
    const weight = individual[i];
    if (weight > 0) {
      RESOURCE_KEYS.forEach(key => {
        totals[key] += (ITEMS[i][key] || 0) * weight;
      });
      totalValue += (ITEMS[i].value || 0) * weight;
    }
  }

  let penaltyMultiplier = 1.0;
  let isValid = true;

  for (const key of RESOURCE_KEYS) {
    if (LIMITS[key] !== undefined && totals[key] > LIMITS[key]) {
      isValid = false;
      const excess = totals[key] - LIMITS[key];
      const excessRatio = excess / LIMITS[key];
      penaltyMultiplier -= excessRatio * 2.0; 
    }
  }

  penaltyMultiplier = Math.max(0, penaltyMultiplier);
  // Redondear a 2 decimales para precisión financiera/cuantitativa
  const finalScore = Math.round((totalValue * penaltyMultiplier) * 100) / 100;

  // Redondear recursos usados para mejor lectura en consola
  Object.keys(totals).forEach(k => {
    totals[k] = Math.round(totals[k] * 100) / 100;
  });

  return { score: finalScore, resourcesUsed: totals, valid: isValid && penaltyMultiplier > 0 };
}

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

// Cruzamiento aritmético para vectores continuos
function crossover(parent1, parent2) {
  const alpha = Math.random();
  const child = parent1.map((p1Val, i) => alpha * p1Val + (1 - alpha) * parent2[i]);
  return normalizeWeights(child);
}

// Mutación continua: aplica pequeños desvíos aleatorios y vuelve a normalizar
function mutate(individual) {
  const mutated = individual.map(gene => {
    if (Math.random() < MUTATION_RATE) {
      const delta = (Math.random() - 0.5) * 0.2; // Desvío de -0.1 a +0.1
      return Math.max(0, gene + delta); // Evitar valores negativos
    }
    return gene;
  });
  return normalizeWeights(mutated);
}

// Ciclo principal de evolución autónoma
function runEvolution() {
  let memory = loadMemory();
  let population = memory.population;

  console.log(`[AI-Continuous] Resumed at Gen ${memory.generation}. Best Portfolio Score: ${memory.bestScore}`);
  console.log(`[AI-Continuous] Dynamic Resources Tracked: [${RESOURCE_KEYS.join(', ')}]`);
  console.log(`[AI-Continuous] Dataset Size: ${ITEMS.length} items | Auto-Calculated Dynamic Factor: ${dynamicFactor.toFixed(3)}`);
  console.log(`[AI-Continuous] Applied Limits:`, LIMITS);

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

        console.log(`[AI-Continuous] Gen ${memory.generation}: 🚀 New Portfolio Record! Score: ${memory.bestScore} | ${usageLog}`);
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
  console.log(`[AI-Continuous] Batch finished. Gen reached: ${memory.generation}. Historic Best Score: ${memory.bestScore}`);
}

runEvolution();
