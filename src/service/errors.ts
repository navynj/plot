/** Typed domain errors (CLAUDE.md §6). Services throw these; actions/routes
 *  translate them into responses — raw messages never reach the client. */
export abstract class DomainError extends Error {
  abstract readonly code: string;
}

export class NodeNotFoundError extends DomainError {
  readonly code = 'NODE_NOT_FOUND';

  constructor(readonly nodeId: string) {
    super(`node not found: ${nodeId}`);
  }
}

export class EmptyCaptureError extends DomainError {
  readonly code = 'EMPTY_CAPTURE';

  constructor() {
    super('a capture needs at least a title or a body');
  }
}
