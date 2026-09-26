const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(__dirname, 'memory.txt');

// ==========================================
// CONFIGURACIÓN DE NIVEL INDUSTRIAL (BENCHMARK)
// ==========================================
// Instancia simulada de gran escala (100 elementos, múltiples restricciones de capacidad)
const CAPACITY = 1250;
const ITEMS = Array.from({ length: 100 }, (_, index) => ({
  id: index + 1,
  weight: Math.floor(Math.sin(index) * 30 + 45), // Pesos variados y realistas
  value: Math.floor(Math.cos(index) * 50 + 90)   // Valores proporcionales con dispersión
}));

const POPULATION_SIZE = 100;
const GENERATIONS_PER_RUN = 50; // Mayor profundidad por ejecución de GitHub Actions
const MUTATION_RATE = 0.03;

// Cargar o inicializar la memoria persistente
function loadMemory() {
  if (!fs.existsSync(MEMORY_PATH)) {
    console.log('[AI] Initializing new evolutionary population for large-scale instance...');
    const initialPopulation = Array.from({ length: POPULATION_SIZE }, () =>
      ITEMS.map(() => (Math.random() > 0.4 ? 1 : 0))
    );
    return { 
      generation: 0, 
      bestScore: 0, 
      bestWeight: 0,
      bestCombination: [], 
      population: initialPopulation 
    };
  }
  return JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
}

function saveMemory(data) {
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Función de evaluación con penalización inteligente
function evaluate(individual) {
  let totalWeight = 0;
  let totalValue = 0;

  for (let i = 0; i < individual.length; i++) {
    if (individual[i] === 1) {
      totalWeight += ITEMS[i].weight;
      totalValue += ITEMS[i].value;
    }
  }

  // Si excede la capacidad de la mochila, la solución es inválida (Fitness = 0)
  if (totalWeight > CAPACITY) return { score: 0, weight: totalWeight };
  return { score: totalValue, weight: totalWeight };
}

// Selección por Torneo binario
function tournamentSelection(population, scores) {
  const k = 4;
  let bestIdx = Math.floor(Math.random() * population.length);
  for (let i = 1; i < k; i++) {
    const idx = Math.floor(Math.random() * population.length);
    if (scores[idx] > scores[bestIdx]) {
      bestIdx = idx;
    }
  }
  return population[bestIdx];
}

// Cruce de un punto (Single-point crossover)
function crossover(parent1, parent2) {
  const point = Math.floor(Math.random() * parent1.length);
  return [...parent1.slice(0, point), ...parent2.slice(point)];
}

// Mutación de genes
function mutate(individual) {
  return individual.map(gene => (Math.random() < MUTATION_RATE ? 1 - gene : gene));
}

// Núcleo del Algoritmo Genético
function runEvolution() {
  let memory = loadMemory();
  let population = memory.population;

  console.log(`[AI] Resumed at Gen ${memory.generation}. Current Best Score: ${memory.bestScore}`);

  for (let gen = 0; gen < GENERATIONS_PER_RUN; gen++) {
    memory.generation++;
    
    // Evaluar toda la población
    const evaluationResults = population.map(evaluate);
    const scores = evaluationResults.map(res => res.score);

    // Actualizar récord global (Elitismo estricto)
    for (let i = 0; i < population.length; i++) {
      if (scores[i] > memory.bestScore) {
        memory.bestScore = scores[i];
        memory.bestWeight = evaluationResults[i].weight;
        memory.bestCombination = [...population[i]];
        console.log(`[AI] Gen ${memory.generation}: 🚀 New Record! Value: ${memory.bestScore} | Weight Used: ${memory.bestWeight}/${CAPACITY}`);
      }
    }

    // Construir nueva generación
    let newPopulation = [];
    
    // Preservar al mejor espécimen directamente (Elitismo)
    const sortedIndices = scores.map((s, idx) => ({ s, idx })).sort((a, b) => b.s - a.s);
    newPopulation.push([...population[sortedIndices[0].idx]]);

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
  console.log(`[AI] Batch finished. Generation reached: ${memory.generation}. Best historic score: ${memory.bestScore}`);
}

runEvolution();
