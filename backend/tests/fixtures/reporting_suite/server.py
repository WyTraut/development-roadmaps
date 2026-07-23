_SCHEDULE_V2 = [
    {
        "key": "daily-data",
        "steps": [
            {"command": "refresh-orders"},
            {"command": "refresh-tasks"},
        ],
    },
    {
        "key": "weekly-data",
        "steps": [
            {"command": "refresh-history"},
        ],
    },
]


def handle(path):
    if path == "/api/orders":
        return "orders"
    if path.startswith("/api/reports/"):
        return "reports"
    return "/api/orders?fresh=true"
