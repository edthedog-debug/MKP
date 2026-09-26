const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(__dirname, 'memory.txt');

// Definición del problema matemático (Problema de la Mochila de alta dimensión)
const CAPACITY = 150;
const ITEMS = [
  { weight: 20, value: 60 },
  { weight: 30, value: 100 },
  { weight: 65, value: 120 },
  { weight: 40, value: 90 },
  { weight: 60, value: 150 },
  { weight: 80, value: 200 },
  { weight: 15, value: 30 },
  { weight: 25, value: 50 },
  { weight: 35, value: 75 },
  { weight: 50, value: 110 }
];

// Cargar memoria previa
function loadMemory() {
  if (!fs.existsSync(MEMORY_PATH)) {
    return { bestScore: 0, bestCombination: [], iterations: 0 };
  }
  const data = fs.readFileSync(MEMORY_PATH, 'utf8');
  try {
    return JSON.parse(data);
  } catch (e) {
    return { bestScore: 0, bestCombination: [], iterations: 0 };
  }
}

// Guardar memoria actualizada
function saveMemory(memory) {
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2), 'utf8');
}

// Algoritmo de mejora estocástica (IA basada en búsqueda local con memoria)
function runIteration() {
  let memory = loadMemory();
  memory.iterations += 1;

  // Generar solución candidata aleatoria o mutada basándose en el historial
  let currentCombination = ITEMS.map(() => Math.random() > 0.5 ? 1 : 0);
  
  let totalWeight = 0;
  let totalValue = 0;

  for (let i = 0; i < ITEMS.length; i++) {
    if (currentCombination[i] === 1) {
      totalWeight += ITEMS[i].weight;
      totalValue += ITEMS[i].value;
    }
  }

  // Validar restricciones del problema matemático
  if (totalWeight <= CAPACITY) {
    if (totalValue > memory.bestScore) {
      console.log(`[AI] New record found! Value: ${totalValue}, Weight: ${totalWeight}`);
      memory.bestScore = totalValue;
      memory.bestCombination = currentCombination;
    } else {
      console.log(`[AI] Valid solution tested, value ${totalValue} did not beat record ${memory.bestScore}`);
    }
  } else {
    console.log(`[AI] Solution invalid (Exceeded capacity: ${totalWeight}/${CAPACITY})`);
  }

  saveMemory(memory);
  console.log(`[AI] Iteration completed. Total runs: ${memory.iterations}`);
}

runIteration();
