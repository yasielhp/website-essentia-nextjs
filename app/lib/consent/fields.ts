/**
 * The centre's informed-consent form (Essentia_Consentimiento_Formato_Tabla.docx,
 * 2026-11-03), one entry per row of its "Estado de salud" table. Every yes/no is
 * required; the detail is free text the client fills when the answer is yes.
 * Labels live in messages/<locale>/consent.json under `fields.<id>`.
 */
export type ConsentField =
  | { id: string; kind: "boolean"; details?: boolean }
  | { id: string; kind: "text"; maxLength: number };

export const CONSENT_FIELDS: ConsentField[] = [
  { id: "surgery", kind: "boolean", details: true }, // Cirugía o intervención médica (incluida estética)
  { id: "thrombosis", kind: "boolean", details: true }, // Trombosis, embolia o flebitis
  { id: "circulatory", kind: "boolean", details: true }, // Enfermedad circulatoria o cardiovascular
  { id: "heartKidney", kind: "boolean", details: true }, // Insuficiencia cardíaca o enfermedad renal
  { id: "cancer", kind: "boolean", details: true }, // Cáncer, tumor o tratamiento oncológico
  { id: "pregnancy", kind: "boolean", details: true }, // Embarazo o posparto
  { id: "injury", kind: "boolean", details: true }, // Fractura, lesión o herida reciente
  { id: "infection", kind: "boolean", details: true }, // Fiebre, infección o inflamación aguda
  { id: "limbSwelling", kind: "boolean", details: true }, // Hinchazón repentina, dolor o enrojecimiento en una extremidad
  { id: "hypertensionDiabetes", kind: "boolean", details: true }, // Hipertensión no controlada o diabetes
  { id: "medication", kind: "boolean", details: true }, // Medicación relevante (especialmente anticoagulantes)
  { id: "allergies", kind: "boolean", details: true }, // Alergias, afecciones cutáneas o reacción a cosméticos
  { id: "other", kind: "boolean", details: true }, // Otra condición de salud relevante
  { id: "avoidZone", kind: "text", maxLength: 500 }, // Zona que prefiera evitar o que requiera especial cuidado
];

export const REQUIRED_IDS = CONSENT_FIELDS.filter(
  (f) => f.kind === "boolean",
).map((f) => f.id);

/**
 * Drops anything that is not a known answer, and answers of the wrong type, so
 * a public endpoint cannot be made to store arbitrary keys.
 */
export function sanitizeAnswers(
  data: Record<string, unknown>,
): Record<string, boolean | string> {
  const clean: Record<string, boolean | string> = {};
  for (const field of CONSENT_FIELDS) {
    const value = data[field.id];
    if (field.kind === "boolean") {
      if (typeof value === "boolean") clean[field.id] = value;
      // A detail explains a yes; one typed and then negated is not kept.
      const detail = data[`${field.id}Detail`];
      if (
        field.details &&
        value === true &&
        typeof detail === "string" &&
        detail.trim()
      ) {
        clean[`${field.id}Detail`] = detail.trim().slice(0, 500);
      }
    } else if (typeof value === "string" && value.trim()) {
      clean[field.id] = value.trim().slice(0, field.maxLength);
    }
  }
  return clean;
}

export function missingRequired(data: Record<string, unknown>): string[] {
  return REQUIRED_IDS.filter((id) => typeof data[id] !== "boolean");
}
