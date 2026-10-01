"""SQLite-backed persistence for the portfolio tracker.

Deliberately small: one table, stdlib `sqlite3`, a fresh connection per
operation. The database file lives next to this package so it survives
server restarts and is trivially portable.
"""
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "market_pulse.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS holdings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT    NOT NULL UNIQUE,
    name        TEXT,
    shares      REAL    NOT NULL CHECK (shares > 0),
    cost_basis  REAL    NOT NULL CHECK (cost_basis >= 0),
    added_at    TEXT    NOT NULL
);
"""


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init(conn: sqlite3.Connection) -> None:
    conn.executescript(_SCHEMA)


def _row(row: sqlite3.Row) -> dict:
    return {key: row[key] for key in row.keys()}


def list_holdings() -> list[dict]:
    """Return every holding, oldest first."""
    with _connect() as conn:
        _init(conn)
        rows = conn.execute(
            "SELECT * FROM holdings ORDER BY added_at, id"
        ).fetchall()
    return [_row(r) for r in rows]


def add_holding(symbol: str, name: str | None, shares: float, cost_basis: float) -> dict:
    """Insert a new holding. Raises ValueError if the symbol is already held."""
    added_at = datetime.now(timezone.utc).isoformat()
    try:
        with _connect() as conn:
            _init(conn)
            cursor = conn.execute(
                "INSERT INTO holdings (symbol, name, shares, cost_basis, added_at)"
                " VALUES (?, ?, ?, ?, ?)",
                (symbol, name, shares, cost_basis, added_at),
            )
            holding_id = cursor.lastrowid
    except sqlite3.IntegrityError as exc:
        raise ValueError(f"{symbol} is already in the portfolio.") from exc

    return {
        "id": holding_id,
        "symbol": symbol,
        "name": name,
        "shares": shares,
        "cost_basis": cost_basis,
        "added_at": added_at,
    }


def update_holding(
    holding_id: int,
    shares: float | None = None,
    cost_basis: float | None = None,
) -> dict | None:
    """Update shares and/or cost basis. Returns the updated row or None."""
    fields = []
    values = []
    if shares is not None:
        fields.append("shares = ?")
        values.append(shares)
    if cost_basis is not None:
        fields.append("cost_basis = ?")
        values.append(cost_basis)
    if not fields:
        return get_holding(holding_id)

    values.append(holding_id)
    with _connect() as conn:
        _init(conn)
        cursor = conn.execute(
            f"UPDATE holdings SET {', '.join(fields)} WHERE id = ?", values
        )
        if cursor.rowcount == 0:
            return None
    return get_holding(holding_id)


def get_holding(holding_id: int) -> dict | None:
    with _connect() as conn:
        _init(conn)
        row = conn.execute(
            "SELECT * FROM holdings WHERE id = ?", (holding_id,)
        ).fetchone()
    return _row(row) if row else None


def delete_holding(holding_id: int) -> bool:
    with _connect() as conn:
        _init(conn)
        cursor = conn.execute("DELETE FROM holdings WHERE id = ?", (holding_id,))
        return cursor.rowcount > 0
