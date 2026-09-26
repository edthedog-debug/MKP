const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(__dirname, 'memory.txt');

// Configuración del Problema (Ampliamos a 40 elementos para que sea un reto real)
const CAPACITY = 350;
const ITEMS = [
  { weight: 20, value: 60 }, { weight: 30, value: 100 }, { weight: 65, value: 120 },
  { weight: 40, value: 90 }, { weight: 60, value: 150 }, { weight: 80, value: 200 },
  { weight: 15, value: 30 }, { weight: 25, value: 50 },  { weight: 35, value: 75 },
  { weight: 50, value: 110 }, { weight: 10, value: 40 }, { weight: 45, value: 95 },
  { weight: 70, value: 130 }, { weight: 22, value: 45 }, { weight: 33, value: 85 },
  { weight: 55, value: 125 }, { weight: 12, value: 25 }, { weight: 28, value: 65 },
  { weight: 48, value: 105 }, { weight: 75, value: 180 }, { weight: 18, value: 35 },
  { weight: 38, value: 80 },  { weight: 62, value: 140 }, { weight: 42, value: 95 },
  { weight: 52, value: 115 }, { weight: 82, value: 210 }, { weight: 14, value: 28 },
  { weight: 27, value: 58 },  { weight: 37, value: 82 },  { weight: 51, value: 112 },
  { weight: 19, value: 42 }, { weight: 31, value: 72 },  { weight: 68, value: 135 },
  { weight: 43, value: 98 }, { weight: 58, value: 145 }, { weight: 78, value: 195 },
  { weight: 16, value: 32 }, { weight: 26, value: 55 },  { weight: 36, value: 78 },
  { weight: 49, value: 108 }
];

const POPULATION_SIZE = 50;
const GENERATIONS_PER_RUN = 30; // Ciclos de evolución por cada ejecución de GitHub Actions
const MUTATION_RATE = 0.05;

// Cargar memoria persistente
function loadMemory() {
  if (!fs.existsSync(MEMORY_PATH)) {
    // Población inicial aleatoria
    const initialPopulation = Array.from({ length: POPULATION_SIZE }, () =>
      ITEMS.map(() => (Math.random() > 0.5 ? 1 : 0))
    );
    return { generation: 0, bestScore: 0, bestCombination: [], population: initialPopulation };
  }
  return JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
}

function saveMemory(data) {
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Calcular la aptitud (Fitness) de una solución
function evaluate(individual) {
  let totalWeight = 0;
  let totalValue = 0;

  for (let i = 0; i < individual.length; i++) {
    if (individual[i] === 1) {
      totalWeight += ITEMS[i].weight;
      totalValue += ITEMS[i].value;
    }
  }

  // Si supera la capacidad, penalizamos drásticamente su aptitud a 0
  if (totalWeight > CAPACITY) return 0;
  return totalValue;
}

// Selección por Torneo
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

// Cruce (Crossover) de dos padres
function crossover(parent1, parent2) {
  const point = Math.floor(Math.random() * parent1.length);
  const child = [...parent1.slice(0, point), ...parent2.slice(point)];
  return child;
}

// Mutación genética
function mutate(individual) {
  return individual.map(gene => (Math.random() < MUTATION_RATE ? 1 - gene : gene));
}

// Ejecución del Algoritmo Genético
function runEvolution() {
  let memory = loadMemory();
  let population = memory.population;

  console.log(`[AI] Starting evolution from Generation ${memory.generation}. Best score so far: ${memory.bestScore}`);

  for (let gen = 0; gen < GENERATIONS_PER_RUN; gen++) {
    memory.generation++;
    
    // Evaluar población actual
    const scores = population.map(evaluate);

    // Encontrar el mejor de esta generación
    for (let i = 0; i < population.length; i++) {
      if (scores[i] > memory.bestScore) {
        memory.bestScore = scores[i];
        memory.bestCombination = [...population[i]];
        console.log(`[AI] Gen ${memory.generation}: New record found -> Score: ${memory.bestScore}`);
      }
    }

    // Crear nueva generación con Elitisme (mantener el mejor)
    let newPopulation = [];
    
    // Ordenar población por puntaje para preservar los mejores (Elitismo)
    const sortedIndices = scores.map((s, idx) => ({ s, idx })).sort((a, b) => b.s - a.s);
    newPopulation.push([...population[sortedIndices[0].idx]]); // Mantener al mejor absoluto

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
  console.log(`[AI] Evolution run finished. Current Generation: ${memory.generation}, Best Score: ${memory.bestScore}`);
}

runEvolution();
