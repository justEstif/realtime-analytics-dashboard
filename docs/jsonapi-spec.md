# JSON:API Specification

This project follows the [JSON:API specification](https://jsonapi.org/) for all API responses.

## Why JSON:API?

JSON:API is a specification for building APIs in JSON. It provides a consistent structure for:

- Resource objects (type, id, attributes, relationships)
- Error responses
- Pagination
- Sorting and filtering
- Compound documents (including related resources)

## Implementation Notes

All API endpoints under `/api` return responses conforming to the JSON:API v1.1 specification.

### Basic Response Structure

```json
{
  "data": {
    "type": "events",
    "id": "1",
    "attributes": {
      "eventType": "page_view",
      "timestamp": "2025-10-15T12:00:00Z"
    }
  }
}
```

### Error Response Structure

```json
{
  "errors": [
    {
      "status": "400",
      "title": "Validation Error",
      "detail": "The 'eventType' field is required"
    }
  ]
}
```

## Resources

- [JSON:API Specification](https://jsonapi.org/)
- [JSON:API Examples](https://jsonapi.org/examples/)
