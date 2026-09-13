/** The closed error set the streets contract publishes. */
export type StreetsErrorCode =
  | 'E_INVALID_PARAMS'
  | 'E_UNSUPPORTED_ARCHITECTURE'
  | 'E_UNSATISFIABLE'
  | 'E_INVARIANT';

export class StreetsError extends Error {
  readonly code: StreetsErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(code: StreetsErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'StreetsError';
    this.code = code;
    this.details = details ? Object.freeze({ ...details }) : undefined;
  }
}

export const invalidParams = (message: string, details?: Record<string, unknown>): StreetsError =>
  new StreetsError('E_INVALID_PARAMS', message, details);

export const unsupportedArchitecture = (
  message: string,
  details?: Record<string, unknown>,
): StreetsError => new StreetsError('E_UNSUPPORTED_ARCHITECTURE', message, details);

export const unsatisfiable = (message: string, details?: Record<string, unknown>): StreetsError =>
  new StreetsError('E_UNSATISFIABLE', message, details);

export const invariant = (message: string, details?: Record<string, unknown>): StreetsError =>
  new StreetsError('E_INVARIANT', message, details);
