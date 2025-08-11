from dataclasses import dataclass

FREE_PLAN_ID=1
MONTHLY_PLAN_ID=2       #50 Credits/month
SEMIANNUAL_PLAN_ID=3    #100 Credits/month

@dataclass(frozen=True)
class PlanSpec:
    monthly_credits:int
    duration_months:int | None


PLANS: dict[int,PlanSpec]={
    FREE_PLAN_ID:PlanSpec(monthly_credits=10,duration_months=None),
    MONTHLY_PLAN_ID:PlanSpec(monthly_credits=50,duration_months=1),
    SEMIANNUAL_PLAN_ID:PlanSpec(monthly_credits=100,duration_months=6),

}