// TODO: Implement Mermaid → C4Model deserialisation.
//
// Expected API:
//   deserializeDiagram(mermaid: string): C4Diagram
//   deserializeProject(mermaid: string): C4Project
//
// Notes:
// - Parse C4Context / C4Container / C4Component / C4Code blocks.
// - Reconstruct the nested diagram tree from %% [SUBSYSTEM:id] markers.
// - Validate depth does not exceed MAX_DEPTH (10).

export {};
