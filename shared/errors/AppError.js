class AppError extends Error {
  constructor(message, statusCode = 400, error = null, data = null) {
    // If the error itself is an AppError, inherit its message and data
    if (error instanceof AppError) {
      super(error.message);
      this.statusCode = error.statusCode;
      this.status = error.status;
      this.data = { ...error.data, ...data }; // merge previous context with new data
    } else {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
      this.data = data;
    }

    this.isOperational = true;
    this.serverError = error;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;