const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(__dirname, 'memory.txt');
const CSV_PATH = path.join(__dirname, 'input_data.csv');

// Capacidad máxima de recursos permitida para esta instancia
const CAPACITY = 350;

const POPULATION_SIZE = 80;
const GENERATIONS_PER_RUN = 40;
const MUTATION_RATE = 0.04;

// Función para leer y parsear el archivo CSV de forma nativa
function loadCSVData() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error('input_data.csv not found! Please provide a valid dataset.');
  }
  const fileContent = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = fileContent.trim().split('\n');
  const items = [];

  // Omitir la cabecera (linea 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    items.push({
      id: parts[0],
      name: parts[1],
      weight: parseFloat(parts[2]),
      value: parseFloat(parts[3])
    });
  }
  return items;
}

const ITEMS = loadCSVData();

// Cargar o inicializar la memoria persistente
function loadMemory() {
  if (!fs.existsSync(MEMORY_PATH)) {
    console.log('[AI] Initializing new evolutionary population from CSV dataset...');
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

// Función de evaluación con penalización estricta por superar la capacidad
function evaluate(individual) {
  let totalWeight = 0;
  let totalValue = 0;

  for (let i = 0; i < individual.length; i++) {
    if (individual[i] === 1) {
      totalWeight += ITEMS[i].weight;
      totalValue += ITEMS[i].value;
    }
  }

  if (totalWeight > CAPACITY) return { score: 0, weight: totalWeight };
  return { score: totalValue, weight: totalWeight };
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

  for (let gen = 0; gen < GENERATIONS_PER_RUN; gen++) {
    memory.generation++;
    
    const evaluationResults = population.map(evaluate);
    const scores = evaluationResults.map(res => res.score);

    for (let i = 0; i < population.length; i++) {
      if (scores[i] > memory.bestScore) {
        memory.bestScore = scores[i];
        memory.bestWeight = evaluationResults[i].weight;
        memory.bestCombination = [...population[i]];
        console.log(`[AI] Gen ${memory.generation}: 🚀 New Record! Optimized Value: ${memory.bestScore} | Resource Used: ${memory.bestWeight}/${CAPACITY}`);
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
