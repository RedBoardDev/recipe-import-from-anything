export abstract class Result<T> {
  public isSuccess: boolean;
  public isFailure: boolean;
  protected _value?: T;
  protected _error?: string;
  protected _errorCode?: string;

  protected constructor(isSuccess: boolean, error?: string, value?: T, errorCode?: string) {
    if (isSuccess && error) {
      throw new Error("InvalidOperation: A result cannot be successful and contain an error");
    }
    if (!isSuccess && !error) {
      throw new Error("InvalidOperation: A failing result needs to contain an error message");
    }

    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this._error = error;
    this._value = value;
    this._errorCode = errorCode;
  }

  public getValue(): T {
    if (!this.isSuccess) {
      throw new Error(`Can't get the value of an error result. Use 'errorValue' instead.`);
    }
    return this._value as T;
  }

  public getError(): string {
    return this._error as string;
  }

  public getErrorCode(): string | undefined {
    return this._errorCode;
  }

  public static ok<U>(value?: U): Result<U> {
    return new Ok<U>(value);
  }

  public static fail<U>(errorMessage: string, error?: unknown): Result<U> {
    if (error !== undefined) {
      console.error(error);
    }
    return new Fail<U>(errorMessage);
  }

  public static combine(results: Result<unknown>[]): Result<unknown> {
    for (const result of results) {
      if (result.isFailure) return result;
    }
    return Result.ok();
  }

  public static async unwrap<U>(resultPromise: Promise<Result<U>>): Promise<U> {
    const result = await resultPromise;

    if (result.isFailure) throw new Error(result.getError());

    return result.getValue();
  }
}

class Ok<T> extends Result<T> {
  constructor(value?: T) {
    super(true, undefined, value);
  }
}

class Fail<T> extends Result<T> {
  constructor(error: string, errorCode?: string) {
    super(false, error, undefined, errorCode);
  }
}
