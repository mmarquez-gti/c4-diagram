// TODO: Implement C4Diagram / C4Project validation.
//
// Expected API:
//   validateDiagram(diagram: C4Diagram): ValidationResult
//   validateProject(project: C4Project): ValidationResult
//
// Checks to implement:
// - Node ids are unique within a diagram.
// - Edge source/target ids reference existing nodes.
// - Diagram depth does not exceed MAX_DEPTH (10).
// - Required string fields (id, title, label) are non-empty.
// - No circular childDiagramId references.

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
