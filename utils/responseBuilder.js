function buildResponse(
  res,
  statusCode = 200,
  message = "",
  data = null,
  isError = false,
  error = null,
  others
) {
  const response = {
    status: isError ? "error" : "success",
    message,
    data,
    timestamp: new Date().toISOString(),
    ...others
  };

  if (isError && error) {
    response.error = error.message || error;
  }

  return res.status(statusCode).json(response);
}

// ✅ Fixed helper shortcuts
buildResponse.success = (res, message, data = {}, code = 200, others) =>
  buildResponse(res, code, message, data, false, null, others );

buildResponse.error = (res, message, code = 400, error = null) =>
  buildResponse(res, code, message, null, true, error);

export default buildResponse;
