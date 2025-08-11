from datetime import datetime, timezone

def now_utc():
    return datetime.now(timezone.utc)

def start_of_utc_month(dt: datetime):
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

def add_calendar_months(dt: datetime, months: int) -> datetime:
    # Safe calendar-month addition without external dependency
    year = dt.year + (dt.month - 1 + months) // 12
    month = (dt.month - 1 + months) % 12 + 1
    day = dt.day

    if month == 12:
        next_month_year, next_month = year + 1, 1
    else:
        next_month_year, next_month = year, month + 1

    # last day of target month
    last_day = (datetime(next_month_year, next_month, 1, tzinfo=dt.tzinfo) - datetime.resolution).day
    day = min(day, last_day)
    return dt.replace(year=year, month=month, day=day)
