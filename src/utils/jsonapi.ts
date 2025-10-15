/**
 * JSON:API Utilities
 *
 * Helper functions and types for JSON:API specification compliance.
 * Reference: https://jsonapi.org/format/
 */

/**
 * JSON:API Resource Object
 */
export interface JsonApiResource<T = Record<string, unknown>> {
  type: string;
  id: string;
  attributes: T;
  links?: {
    self?: string;
  };
}

/**
 * JSON:API Success Response
 */
export interface JsonApiSuccessResponse<T = Record<string, unknown>> {
  data: JsonApiResource<T>;
}

/**
 * JSON:API Error Object
 */
export interface JsonApiErrorObject {
  status: string;
  title: string;
  detail: string;
  source?: {
    pointer?: string;
    parameter?: string;
    header?: string;
  };
}

/**
 * JSON:API Error Response
 */
export interface JsonApiErrorResponse {
  errors: JsonApiErrorObject[];
}

/**
 * Create a JSON:API success response with a single resource
 */
export function createSuccessResponse<T = Record<string, unknown>>(
  type: string,
  id: string,
  attributes: T,
  selfLink?: string
): JsonApiSuccessResponse<T> {
  const resource: JsonApiResource<T> = {
    type,
    id,
    attributes,
  };

  if (selfLink) {
    resource.links = { self: selfLink };
  }

  return { data: resource };
}

/**
 * Create a JSON:API error response
 */
export function createErrorResponse(
  errors: JsonApiErrorObject[]
): JsonApiErrorResponse {
  return { errors };
}

/**
 * Create a single JSON:API error object
 */
export function createError(
  status: string,
  title: string,
  detail: string,
  source?: JsonApiErrorObject["source"]
): JsonApiErrorObject {
  const error: JsonApiErrorObject = {
    status,
    title,
    detail,
  };

  if (source) {
    error.source = source;
  }

  return error;
}

/**
 * Convert Zod validation errors to JSON:API error objects
 */
export function zodErrorsToJsonApi(
  zodErrors: Array<{ path: PropertyKey[]; message: string }>
): JsonApiErrorObject[] {
  return zodErrors.map((error) => {
    // Build pointer path from the error path
    // Zod validation includes the full path from the root schema
    // Filter out symbols and convert to strings/numbers only
    const pathArray = error.path.filter(
      (p): p is string | number => typeof p !== "symbol"
    );

    // If it starts with "data.attributes", strip those two elements
    // and rebuild as /data/attributes/{field}
    if (pathArray[0] === "data" && pathArray[1] === "attributes") {
      pathArray.splice(0, 2);
      const pointer = `/data/attributes/${pathArray.join("/")}`;
      return createError("400", "Invalid Attribute", error.message, {
        pointer,
      });
    }

    // Otherwise, just use the path as-is (e.g., /data/type)
    const pointer = `/${pathArray.join("/")}`;
    return createError("400", "Invalid Request", error.message, { pointer });
  });
}
