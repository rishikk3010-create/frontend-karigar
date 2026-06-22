// Karigar skill taxonomy: category -> sub-skills.
// Categories with no sub-skills (e.g. Supervisor/Coordinator) are selected directly.
export interface SkillCategory {
  key: string;
  label: string;
  subs: string[];
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  { key: "handwork", label: "Handwork", subs: ["Aari", "Zardozi", "Dabka", "Sitara/Sequin", "Mukaish"] },
  { key: "machinework", label: "Machinework", subs: ["Machine Embroidery", "Bead Work"] },
  { key: "master", label: "Master", subs: ["Pattern Master", "Cutting Master", "Tailor"] },
  { key: "qc", label: "QC", subs: ["Cutting", "Finishing", "Spotting", "Line QC", "Mid QC", "Final QC"] },
  { key: "supervisor", label: "Supervisor/Coordinator", subs: [] },
];

// Flat list of every selectable skill value (sub-skills + leaf categories).
export const ALL_SKILLS: string[] = SKILL_CATEGORIES.flatMap((c) => (c.subs.length ? c.subs : [c.label]));
