export function currentRole() {
  try { return JSON.parse(localStorage.getItem("usuario") || "{}").rol || ""; }
  catch { return ""; }
}

export function canManagePlanning() {
  return ["Administrador", "Ingeniero"].includes(currentRole());
}

export const canManageAssets = canManagePlanning;
