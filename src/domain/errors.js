/**
 * Erros de domínio. A camada HTTP traduz cada tipo para um status code,
 * então o domínio não conhece HTTP (SRP / DIP).
 */
export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class InvalidStateError extends DomainError {
  constructor(message) {
    super(message);
    this.name = 'InvalidStateError';
  }
}
