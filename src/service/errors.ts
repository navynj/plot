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

export class FieldTypeMismatchError extends DomainError {
  readonly code = 'FIELD_TYPE_MISMATCH';

  constructor(
    readonly key: string,
    readonly expected: string,
    readonly got: string
  ) {
    super(`field "${key}" expects ${expected}, got: ${got}`);
  }
}

export class LinkTargetNotFoundError extends DomainError {
  readonly code = 'LINK_TARGET_NOT_FOUND';

  constructor(
    readonly key: string,
    readonly targetId: string
  ) {
    super(`field "${key}" links to a node that does not exist: ${targetId}`);
  }
}

export class InvalidSchemaError extends DomainError {
  readonly code = 'INVALID_SCHEMA';

  constructor(reason: string) {
    super(`invalid childSchema: ${reason}`);
  }
}

export class SelfLinkError extends DomainError {
  readonly code = 'SELF_LINK';

  constructor(readonly nodeId: string) {
    super(`a node cannot be linked to itself: ${nodeId}`);
  }
}

export class LinkTargetOutOfScopeError extends DomainError {
  readonly code = 'LINK_TARGET_OUT_OF_SCOPE';

  constructor(
    readonly key: string,
    readonly targetId: string,
    readonly requiredParentId: string
  ) {
    super(`field "${key}" must link to a child of ${requiredParentId}; ${targetId} is not one`);
  }
}

export class CycleError extends DomainError {
  readonly code = 'CYCLE';

  constructor(
    readonly nodeId: string,
    readonly targetId: string
  ) {
    super(`node ${nodeId} cannot become a descendant of itself (target ${targetId})`);
  }
}

export class TriageError extends DomainError {
  readonly code = 'TRIAGE';

  constructor(reason: string) {
    super(reason);
  }
}

export class InvalidViewSpecError extends DomainError {
  readonly code = 'INVALID_VIEW_SPEC';

  constructor(reason: string) {
    super(`invalid viewSpec: ${reason}`);
  }
}

export class UnsupportedFilterError extends DomainError {
  readonly code = 'UNSUPPORTED_FILTER';

  constructor(detail: string) {
    super(`aggregation filter not supported: ${detail}`);
  }
}

export class HabitNotFoundError extends DomainError {
  readonly code = 'HABIT_NOT_FOUND';

  constructor(readonly habitId: string) {
    super(`habit not found: ${habitId}`);
  }
}

/** A habit's target parent node is gone (soft-deleted). Toggling is disabled
 *  rather than crashing — the stream dims such a habit. */
export class HabitParentMissingError extends DomainError {
  readonly code = 'HABIT_PARENT_MISSING';

  constructor(readonly habitId: string) {
    super(`habit ${habitId} has no target parent (it was deleted)`);
  }
}

export class HabitError extends DomainError {
  readonly code = 'HABIT';

  constructor(reason: string) {
    super(reason);
  }
}

/** A declarative validation rule (FieldDef.validate) was violated at save.
 *  Carries the offending field key so the editor can point at it; the message
 *  is the rule's custom text or a generated one ("wake up at must be after
 *  sleep at"). Actions translate this into an inline form error. */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION';

  constructor(
    readonly key: string,
    message: string
  ) {
    super(message);
  }
}
