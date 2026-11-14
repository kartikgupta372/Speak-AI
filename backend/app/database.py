from supabase import create_client, Client

from .config import settings

_client: Client | None = None


def get_supabase() -> Client:
    """Return a singleton Supabase client."""
    global _client
    if _client is None:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return _client


def fetch_one(table: str, *, eq: dict, columns: str = "*") -> dict | None:
    """
    Safe single-row fetch.

    The Supabase Python client's `maybe_single()` returns None (not an
    object with `.data = None`) when no row matches — using `.data` on
    that crashes with AttributeError. This helper avoids the foot-gun.

    Parameters
    ----------
    table   : str         e.g. "user_profiles"
    eq      : dict        column → value pairs to filter on (all ANDed)
    columns : str         columns to select (default "*")

    Returns
    -------
    dict | None
        The first matching row as a dict, or None if no row matches.
    """
    client = get_supabase()
    query = client.table(table).select(columns)
    for col, val in eq.items():
        query = query.eq(col, val)
    result = query.limit(1).execute()
    rows = result.data or []
    return rows[0] if rows else None
