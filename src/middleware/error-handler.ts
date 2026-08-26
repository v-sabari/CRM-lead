import { Request, Response, NextFunction } from 'express';

export class BadRequestError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class UnauthenticatedError extends Error {
  statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

export class UnauthorizedError extends Error {
  statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  console.error('Error:', err);

  if (
    err instanceof BadRequestError ||
    err instanceof UnauthenticatedError ||
    err instanceof UnauthorizedError ||
    err instanceof NotFoundError
  ) {
    res.status(err.statusCode).json({
      message: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  res.status(500).json({
    message: 'Internal server error',
    statusCode: 500,
  });
}
