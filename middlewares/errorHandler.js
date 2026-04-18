import chalk from "chalk";
import errorLogSchema from "../domain/system/errors/error.model.js";

export default async (err, req, res, next) => {
  const timestamp = chalk.magenta(new Date().toISOString());
  const url = chalk.blue(req.originalUrl || req.url);
  const method = chalk.cyan(req.method);

  const logErrorToDB = async (errorDetails) => {
    try {
      await errorLogSchema.create(errorDetails);
    } catch (dbErr) {
      console.error(chalk.red("Failed to save error log to DB:"), dbErr);
    }
  };

  if (err.isOperational) {
    if (err.statusCode >= 500) {
      console.error(
        `${chalk.red.bold(" SERVER ERROR (operational)")}\n`,
        `${chalk.gray("Time:")} ${timestamp}\n`,
        `${chalk.gray("Method:")} ${method}\n`,
        `${chalk.gray("URL:")} ${url}\n`,
        `${chalk.gray("Status Code:")} ${chalk.yellow(err.statusCode)}\n`,
        `${chalk.gray("Message:")} ${chalk.white(err.message)}\n`,
        err.serverError ? `${chalk.gray("Extra:")} ${chalk.gray(err.serverError)}` : ""
      );

      // Log to DB
      await logErrorToDB({
        type: "operational",
        statusCode: err.statusCode,
        message: err.message,
        extra: err.serverError || "",
        method: req.method,
        url: req.originalUrl || req.url,
        timestamp: new Date()
      });
    } else {
      console.warn(
        `${chalk.yellow.bold("⚠️ CLIENT ERROR")}\n`,
        `${chalk.gray("Time:")} ${timestamp}\n`,
        `${chalk.gray("Method:")} ${method}\n`,
        `${chalk.gray("URL:")} ${url}\n`,
        `${chalk.gray("Status Code:")} ${chalk.yellow(err.statusCode)}\n`,
        `${chalk.gray("Message:")} ${chalk.white(err.message)}`,
        err.serverError ? `${chalk.gray("Extra:")} ${chalk.gray(err.serverError)}` : "",
        `${chalk.gray("Error:")} ${chalk.white(err.stack || err)}`


      );
    }

    return res.status(err.statusCode).json({
      status: err.status || "error",
      message: err.message || "Something went wrong. Please try again later."
    });
  }

  console.error(
    `${chalk.red.bold(" UNEXPECTED ERROR")}\n`,
    `${chalk.gray("Time:")} ${timestamp}\n`,
    `${chalk.gray("Method:")} ${method}\n`,
    `${chalk.gray("URL:")} ${url}\n`,
    `${chalk.gray("Error:")} ${chalk.white(err.stack || err)}`
  );

  // Log unexpected error to DB
  await logErrorToDB({
    type: "unexpected",
    statusCode: 500,
    message: err.message || "Unknown error",
    stack: err.stack || "",
    method: req.method,
    url: req.originalUrl || req.url,
    timestamp: new Date()
  });

  res.status(500).json({
    status: "error",
    message: "Something went wrong. Please try again later."
  });
};