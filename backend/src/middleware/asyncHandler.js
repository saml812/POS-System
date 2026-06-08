/**
 * Wraps an async Express handler so any thrown error or rejected promise is
 * forwarded to the error-handling middleware. Removes the repetitive
 * `try { ... } catch (error) { next(error); }` boilerplate from controllers.
 */
export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
