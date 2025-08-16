from datetime import datetime
from sqlalchemy.orm import Session
from app.models.user import User
from app.billing.plans import PLANS, FREE_PLAN_ID
from app.billing.timeutils import now_utc, start_of_utc_month, add_calendar_months

def compute_paid_cycle_start(anchor_utc: datetime, current_utc: datetime):
    # If no anchor, fall back to calendar month start
    if anchor_utc is None:
        return start_of_utc_month(current_utc)
    cycle_start = anchor_utc
    # Advance by months until next boundary is in the future
    while True:
        next_boundary = add_calendar_months(cycle_start, 1)
        if next_boundary > current_utc:
            return cycle_start
        cycle_start = next_boundary

def is_reset_due_free(user: User, current_utc: datetime):
    cycle_start = start_of_utc_month(current_utc)
    last = user.last_credit_reset_at
    return (last is None) or (last < cycle_start), cycle_start

def is_reset_due_paid(user: User, current_utc: datetime) -> tuple[bool, datetime]:
    cycle_start = compute_paid_cycle_start(user.billing_anchor_utc, current_utc)
    last = user.last_credit_reset_at
    return (last is None) or (last < cycle_start), cycle_start

def handle_expiration(user: User, current_utc: datetime) -> bool:
    if user.plan_expires_at and user.plan_expires_at <= current_utc:
        user.plan_id = FREE_PLAN_ID
        user.plan_started_at = None
        user.plan_expires_at = None
        user.billing_anchor_utc = None
        user.credit_balance = PLANS[FREE_PLAN_ID].monthly_credits
        user.last_credit_reset_at = current_utc
        return True
    return False

def apply_monthly_reset(user: User, current_utc: datetime) -> bool:
    spec = PLANS.get(user.plan_id, PLANS[FREE_PLAN_ID])
    if user.plan_id == FREE_PLAN_ID:
        due, cycle_start = is_reset_due_free(user, current_utc)
    else:
        due, cycle_start = is_reset_due_paid(user, current_utc)
    
    if not due:
        return False
    
    user.credit_balance = spec.monthly_credits
    user.last_credit_reset_at = current_utc
    return True
