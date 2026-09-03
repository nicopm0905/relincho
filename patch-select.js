const fs = require('fs');
const path = require('path');

const files = [
  "src/components/sanidad/mass-health-dialog.tsx",
  "src/components/reproduction/pregnancy-check-dialog.tsx",
  "src/components/reproduction/foaling-dialog.tsx",
  "src/components/reproduction/kanban-board.tsx",
  "src/components/reproduction/create-covering-dialog.tsx",
  "src/components/horses/horse-form.tsx"
];

const TRANSLATIONS = `
const SELECT_TRANSLATIONS: Record<string, string> = {
  MALE: "Macho", FEMALE: "Hembra", UNKNOWN: "Desconocido", GELDING: "Macho (Castrado)",
  ACTIVE: "Activo", INACTIVE: "Inactivo", SOLD: "Vendido", DECEASED: "Fallecido",
  POSITIVE: "Positiva", NEGATIVE: "Negativa", TWINS: "Gemelos", REABSORBED: "Reabsorbida", ABORTION: "Aborto",
  NATURAL: "Monta Natural", AI_FRESH: "IA Fresco", AI_CHILLED: "IA Refrigerado", AI_FROZEN: "IA Congelado",
  DEWORMING: "Desparasitación", VACCINATION: "Vacunación", DENTISTRY: "Odontología", FARRIER: "Herrador", VET_CHECK: "Revisión Veterinaria", TREATMENT: "Tratamiento Médico", OTHER: "Otro"
};
`;

files.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Only patch if not already patched
  if (content.includes('SELECT_TRANSLATIONS')) return;

  // Insert the translations map after imports
  const importEnd = content.lastIndexOf('import ');
  const nextLine = content.indexOf('\n', importEnd) + 1;
  content = content.slice(0, nextLine) + TRANSLATIONS + content.slice(nextLine);

  // Replace <SelectValue placeholder="..." /> with the render prop
  content = content.replace(/<SelectValue placeholder="([^"]+)" \/>/g, 
    `<SelectValue placeholder="$1">
                          {(val: string) => SELECT_TRANSLATIONS[val] || val}
                        </SelectValue>`
  );

  fs.writeFileSync(fullPath, content);
  console.log('Patched', file);
});
