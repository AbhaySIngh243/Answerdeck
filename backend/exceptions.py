class APIError(Exception):
    """Base API Error exception"""
    def __init__(self, message, status_code=400, payload=None):
        Exception.__init__(self)
        self.message = message
        self.status_code = status_code
        self.payload = payload

    def to_dict(self):
        payload = self.payload
        if not payload:
            rv = {}
        elif isinstance(payload, dict):
            rv = dict(payload)
        elif isinstance(payload, list):
            # Pydantic ValidationError.errors() is a list, not a mapping.
            rv = {"details": payload}
        else:
            rv = {"detail": str(payload)}
        rv["error"] = self.message
        return rv

class NotFoundError(APIError):
    def __init__(self, message="Resource not found", payload=None):
        super().__init__(message, status_code=404, payload=payload)

class ValidationError(APIError):
    def __init__(self, message="Invalid input", payload=None):
        super().__init__(message, status_code=400, payload=payload)
