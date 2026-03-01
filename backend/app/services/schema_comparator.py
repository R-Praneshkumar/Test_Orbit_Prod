"""
Schema comparator: compares JSON response data against OpenAPI schemas.
Detects type mismatches, missing required fields, extra fields, invalid enums, and format issues.
"""
import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


# Supported OpenAPI format validators (subset — covers the most common ones)
_FORMAT_VALIDATORS = {
    "date-time": re.compile(
        r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}"
    ),
    "date": re.compile(r"^\d{4}-\d{2}-\d{2}$"),
    "email": re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
    "uuid": re.compile(
        r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
    ),
    "uri": re.compile(r"^https?://"),
    "ipv4": re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$"),
}

# Map Python types to OpenAPI type strings
_PYTHON_TO_OPENAPI_TYPE = {
    str: "string",
    int: "integer",
    float: "number",
    bool: "boolean",
    list: "array",
    dict: "object",
    type(None): "null",
}


def _get_openapi_type(value: Any) -> str:
    """Return the OpenAPI type name for a Python value."""
    return _PYTHON_TO_OPENAPI_TYPE.get(type(value), type(value).__name__)


def _resolve_ref(ref: str, spec: dict) -> dict:
    """
    Resolve a JSON $ref pointer like '#/components/schemas/User'.
    Returns the resolved schema dict, or an empty dict if not found.
    """
    if not ref or not ref.startswith("#/"):
        return {}
    parts = ref.lstrip("#/").split("/")
    node = spec
    for part in parts:
        if isinstance(node, dict):
            node = node.get(part, {})
        else:
            return {}
    return node if isinstance(node, dict) else {}


def _resolve_schema(schema: dict, spec: dict) -> dict:
    """Resolve a schema that may contain a $ref, returning the actual schema."""
    if not schema:
        return {}
    if "$ref" in schema:
        return _resolve_ref(schema["$ref"], spec)
    return schema


def _is_type_compatible(spec_type: str, value: Any) -> bool:
    """Check if a Python value is compatible with an OpenAPI type."""
    actual = _get_openapi_type(value)
    if spec_type == actual:
        return True
    # number accepts both int and float
    if spec_type == "number" and actual in ("integer", "number"):
        return True
    # integer accepts int
    if spec_type == "integer" and actual == "integer":
        return True
    # nullable
    if actual == "null":
        return False  # handled separately via nullable check
    return False


def compare_to_schema(
    data: Any, schema: dict, spec: dict, path: str = "$"
) -> list[dict]:
    """
    Compare actual JSON data against an OpenAPI schema definition.

    Args:
        data: The actual response data (parsed JSON).
        schema: The OpenAPI schema object for this data.
        spec: The full OpenAPI spec (needed for $ref resolution).
        path: JSON path prefix for drift reporting (default '$').

    Returns:
        A list of drift items, each with:
            field, spec_type, actual_type, issue, severity, message
    """
    drifts: list[dict] = []
    schema = _resolve_schema(schema, spec)
    if not schema:
        return drifts

    # Handle composed schemas: allOf, oneOf, anyOf
    if "allOf" in schema:
        drifts.extend(_compare_all_of(data, schema["allOf"], spec, path))
        return drifts
    if "oneOf" in schema:
        drifts.extend(_compare_one_of(data, schema["oneOf"], spec, path))
        return drifts
    if "anyOf" in schema:
        drifts.extend(_compare_any_of(data, schema["anyOf"], spec, path))
        return drifts

    spec_type = schema.get("type", "")
    nullable = schema.get("nullable", False)

    # Null check
    if data is None:
        if not nullable and spec_type:
            drifts.append({
                "field": path,
                "spec_type": spec_type,
                "actual_type": "null",
                "issue": "type_mismatch",
                "severity": "error",
                "message": f"Expected {spec_type} but got null (field is not nullable)",
            })
        return drifts

    # Type check
    if spec_type and not _is_type_compatible(spec_type, data):
        actual_type = _get_openapi_type(data)
        drifts.append({
            "field": path,
            "spec_type": spec_type,
            "actual_type": actual_type,
            "issue": "type_mismatch",
            "severity": "error",
            "message": f"Expected type '{spec_type}' but got '{actual_type}'",
        })
        return drifts  # No point checking children if top-level type is wrong

    # Enum check
    if "enum" in schema and data not in schema["enum"]:
        drifts.append({
            "field": path,
            "spec_type": f"enum({schema['enum']})",
            "actual_type": _get_openapi_type(data),
            "issue": "invalid_enum",
            "severity": "error",
            "message": f"Value '{data}' is not in allowed enum values: {schema['enum']}",
        })

    # Format check
    fmt = schema.get("format")
    if fmt and isinstance(data, str):
        validator = _FORMAT_VALIDATORS.get(fmt)
        if validator and not validator.match(data):
            drifts.append({
                "field": path,
                "spec_type": f"string({fmt})",
                "actual_type": "string",
                "issue": "invalid_format",
                "severity": "info",
                "message": f"Value '{data[:50]}' does not match format '{fmt}'",
            })

    # Object check
    if spec_type == "object" or (not spec_type and "properties" in schema):
        if isinstance(data, dict):
            drifts.extend(_compare_object(data, schema, spec, path))

    # Array check
    if spec_type == "array" and isinstance(data, list):
        items_schema = schema.get("items", {})
        if items_schema and data:
            # Check only the first few items to avoid explosion on large arrays
            for i, item in enumerate(data[:5]):
                drifts.extend(
                    compare_to_schema(item, items_schema, spec, f"{path}[{i}]")
                )

    return drifts


def _compare_object(
    data: dict, schema: dict, spec: dict, path: str
) -> list[dict]:
    """Compare a dict against an object schema."""
    drifts: list[dict] = []
    properties = schema.get("properties", {})
    required = set(schema.get("required", []))

    # Check for missing required fields
    for field_name in required:
        if field_name not in data:
            prop_schema = _resolve_schema(properties.get(field_name, {}), spec)
            expected_type = prop_schema.get("type", "unknown")
            drifts.append({
                "field": f"{path}.{field_name}",
                "spec_type": expected_type,
                "actual_type": "missing",
                "issue": "missing_required",
                "severity": "error",
                "message": f"Required field '{field_name}' is missing from response",
            })

    # Check declared properties
    for field_name, field_schema in properties.items():
        if field_name in data:
            drifts.extend(
                compare_to_schema(
                    data[field_name], field_schema, spec, f"{path}.{field_name}"
                )
            )

    # Check for extra fields not in schema
    if properties:
        additional = schema.get("additionalProperties")
        # If additionalProperties is explicitly False, or not set and there are declared properties
        if additional is False or (additional is None and properties):
            for field_name in data:
                if field_name not in properties:
                    drifts.append({
                        "field": f"{path}.{field_name}",
                        "spec_type": "not_defined",
                        "actual_type": _get_openapi_type(data[field_name]),
                        "issue": "extra_field",
                        "severity": "warning",
                        "message": f"Field '{field_name}' exists in response but is not defined in the schema",
                    })

    return drifts


def _compare_all_of(
    data: Any, schemas: list, spec: dict, path: str
) -> list[dict]:
    """
    allOf: data must match ALL schemas. Merge properties from all sub-schemas
    and validate against the merged result.
    """
    drifts: list[dict] = []
    merged_properties: dict = {}
    merged_required: list = []

    for sub_schema in schemas:
        resolved = _resolve_schema(sub_schema, spec)
        merged_properties.update(resolved.get("properties", {}))
        merged_required.extend(resolved.get("required", []))

    merged = {
        "type": "object",
        "properties": merged_properties,
        "required": merged_required,
    }
    drifts.extend(compare_to_schema(data, merged, spec, path))
    return drifts


def _compare_one_of(
    data: Any, schemas: list, spec: dict, path: str
) -> list[dict]:
    """
    oneOf: data must match EXACTLY one schema. Try each; if none match, report drift.
    """
    match_count = 0
    best_drifts: list[dict] = []

    for sub_schema in schemas:
        resolved = _resolve_schema(sub_schema, spec)
        sub_drifts = compare_to_schema(data, resolved, spec, path)
        if not sub_drifts:
            match_count += 1
        elif not best_drifts or len(sub_drifts) < len(best_drifts):
            best_drifts = sub_drifts

    if match_count == 0:
        # No schema matched — return the drifts from the best (closest) match
        return best_drifts
    return []


def _compare_any_of(
    data: Any, schemas: list, spec: dict, path: str
) -> list[dict]:
    """
    anyOf: data must match AT LEAST one schema. Try each; if none match, report drift.
    """
    best_drifts: list[dict] = []

    for sub_schema in schemas:
        resolved = _resolve_schema(sub_schema, spec)
        sub_drifts = compare_to_schema(data, resolved, spec, path)
        if not sub_drifts:
            return []  # At least one matched
        if not best_drifts or len(sub_drifts) < len(best_drifts):
            best_drifts = sub_drifts

    return best_drifts


def parse_openapi_spec(spec_str: str) -> dict:
    """
    Parse an OpenAPI spec from a JSON or YAML string.
    Returns the parsed dict, or an empty dict on failure.
    """
    if not spec_str or not spec_str.strip():
        return {}
    try:
        spec_str = spec_str.strip()
        if spec_str.startswith("{"):
            return json.loads(spec_str)
        # Try YAML
        try:
            import yaml
            return yaml.safe_load(spec_str)
        except Exception:
            return json.loads(spec_str)
    except Exception as e:
        logger.error(f"Failed to parse OpenAPI spec: {e}")
        return {}


def extract_response_schema(spec: dict, path: str, method: str, status_code: str = "200") -> dict:
    """
    Extract the response schema for a given endpoint from an OpenAPI spec.
    Tries the specified status code, then '2XX', then 'default'.
    """
    paths = spec.get("paths", {})
    path_item = paths.get(path, {})
    operation = path_item.get(method.lower(), {})
    responses = operation.get("responses", {})

    # Try exact status code, then wildcard, then default
    for code in [status_code, f"{status_code[0]}XX", "default"]:
        resp = responses.get(code, {})
        if resp:
            # OpenAPI 3.x
            content = resp.get("content", {})
            json_content = content.get("application/json", {})
            schema = json_content.get("schema", {})
            if schema:
                return schema
            # OpenAPI 2.x (Swagger)
            if "schema" in resp:
                return resp["schema"]

    return {}
