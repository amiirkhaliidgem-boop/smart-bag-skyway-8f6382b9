// Quality Incident categories and priority matrix.

export const INCIDENT_CATEGORIES = [
  "Possible Misconduct",
  "Money Request / Extortion",
  "Unprofessional Behaviour",
  "Damaged Baggage",
  "Missing Baggage",
  "Late Delivery",
  "Other",
] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export const CATEGORY_PRIORITY: Record<IncidentCategory, "High" | "Medium" | "Low"> = {
  "Possible Misconduct": "High",
  "Money Request / Extortion": "High",
  "Unprofessional Behaviour": "Medium",
  "Damaged Baggage": "High",
  "Missing Baggage": "High",
  "Late Delivery": "Medium",
  Other: "Low",
};