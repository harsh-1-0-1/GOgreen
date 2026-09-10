"""Shared ticket ID generation utility for all inquiry/claim types."""


def make_ticket_id(prefix: str, pk: int) -> str:
    """Generate a deterministic ticket ID from a prefix and primary key.
    
    Args:
        prefix: Short type identifier (e.g., "INQ" for inquiry, "DR" for damage report)
        pk: The database primary key (must be a positive integer)
    
    Returns:
        Formatted ticket ID: PLG-{prefix}-{pk:06d}
        Example: make_ticket_id("INQ", 42) -> "PLG-INQ-000042"
    """
    return f"PLG-{prefix}-{pk:06d}"
