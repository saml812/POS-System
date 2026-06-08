import { Prisma } from "../../generated/prisma/client.ts";
import { appError } from "../lib/appError.js";

/**
 * 404 Not Found handler
 * Creates an error for routes that don't exist
 */
const notFound = (req, res, next) => {
  next(appError(`Route ${req.originalUrl} not found`, 404));
};

/**
 * Global error handler middleware
 * Handles all errors in the application and sends appropriate responses
 * Provides detailed error information in development, minimal info in production
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Handle Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    err.statusCode = 400;
    err.message = "Invalid data provided";
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const field = err.meta?.target?.[0] || "field";
      err.statusCode = 400;
      err.message = `${field} already exists`;
    } else if (err.code === "P2025") {
      err.statusCode = 404;
      err.message = "Record not found";
    } else if (err.code === "P2003") {
      err.statusCode = 400;
      err.message = "Invalid reference: related record does not exist";
    }
  }

  // Send error response
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export { notFound, errorHandler };