"""Generate pgAdmin connection settings from the same env as PostgreSQL."""
import json
import os
from pathlib import Path


def escape_pgpass(value):
    if "\n" in value or "\r" in value:
        raise ValueError("PostgreSQL credentials must not contain newlines")
    return value.replace("\\", "\\\\").replace(":", "\\:")


def configure():
    database = os.environ["POSTGRES_DB"]
    username = os.environ["POSTGRES_USER"]
    password = os.environ["POSTGRES_PASSWORD"]
    passfile = Path("/var/lib/pgadmin/.pgpass")
    # PostgreSQL checks mode 0600; regenerate on every start, including existing volumes.
    entry = ":".join(["db", "5432", "*", escape_pgpass(username), escape_pgpass(password)])
    fd = os.open(passfile, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as output:
        os.fchmod(output.fileno(), 0o600)
        output.write(entry + "\n")
    server = {
        "Name": "Postgraduate Student Management",
        "Group": "Project Databases",
        "Host": "db", "Port": 5432,
        "MaintenanceDB": database, "Username": username,
        "SSLMode": "prefer", "PassFile": str(passfile),
    }
    Path(os.environ["PGADMIN_SERVER_JSON_FILE"]).write_text(
        json.dumps({"Servers": {"1": server}}), encoding="utf-8"
    )


if __name__ == "__main__":
    configure()
    os.execv("/entrypoint.sh", ["/entrypoint.sh"])
