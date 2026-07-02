export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly payload: unknown;

  constructor(input: {
    message: string;
    status: number;
    code: string;
    payload?: unknown;
  }) {
    super(input.message);
    this.name = "ApiError";
    this.status = input.status;
    this.code = input.code;
    this.payload = input.payload;
  }
}
