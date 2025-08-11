from billing.timeutils import now_utc, add_calendar_months
from billing.plans import PLANS, FREE_PLAN_ID
from app.models.user import User

def assign_paid_plan(user: User, plan_id: int):
    spec = PLANS[plan_id]
    assert spec.duration_months is not None, "Paid plan must have duration"
    now = now_utc()
    user.plan_id = plan_id
    user.plan_started_at = now
    user.billing_anchor_utc = now
    user.plan_expires_at = add_calendar_months(now, spec.duration_months)
    user.credit_balance = spec.monthly_credits
    user.last_credit_reset_at = now


def revert_to_free(user: User):
    now = now_utc()
    user.plan_id = FREE_PLAN_ID
    user.plan_started_at = None
    user.plan_expires_at = None
    user.billing_anchor_utc = None
    user.credit_balance = PLANS[FREE_PLAN_ID].monthly_credits
    user.last_credit_reset_at = now