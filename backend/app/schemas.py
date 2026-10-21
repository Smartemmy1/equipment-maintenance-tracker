"""Pydantic schemas: request validation and response shapes."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models import Category, Criticality, EquipmentStatus, InspectionResult, Severity

InspectionState = Literal["overdue", "due_soon", "ok"]


# ---------- Equipment ----------
class EquipmentBase(BaseModel):
    tag: str = Field(min_length=1, max_length=30, examples=["P-101A"])
    name: str = Field(min_length=1, max_length=120, examples=["Crude transfer pump A"])
    category: Category
    location: str = Field(min_length=1, max_length=120, examples=["Avalon Ridge Platform"])
    criticality: Criticality = Criticality.medium
    inspection_interval_days: int = Field(ge=1, le=3650, examples=[90])
    installed_on: date
    notes: str = ""


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    location: str | None = Field(default=None, min_length=1, max_length=120)
    criticality: Criticality | None = None
    status: EquipmentStatus | None = None
    inspection_interval_days: int | None = Field(default=None, ge=1, le=3650)
    notes: str | None = None


class EquipmentOut(EquipmentBase):
    """Equipment plus its computed inspection schedule."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    status: EquipmentStatus
    last_inspection: date | None = None
    next_inspection_due: date
    days_until_due: int  # negative when overdue
    inspection_state: InspectionState
    open_failures: int = 0


class ReliabilityMetrics(BaseModel):
    failure_count: int
    mtbf_days: float | None  # mean time between failures
    mttr_hours: float | None  # mean time to repair (resolved failures)
    availability: float  # fraction of the last 365 days not down for a failure


class EquipmentDetail(EquipmentOut):
    metrics: ReliabilityMetrics


# ---------- Inspections ----------
class InspectionIn(BaseModel):
    date: date
    inspector: str = Field(min_length=1, max_length=80)
    result: InspectionResult
    notes: str = ""


class InspectionOut(InspectionIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    equipment_id: int


# ---------- Failures ----------
class FailureIn(BaseModel):
    reported_on: date
    description: str = Field(min_length=1, max_length=2000)
    severity: Severity


class FailureResolve(BaseModel):
    resolved_on: date
    downtime_hours: float = Field(ge=0, le=100_000)
    resolution: str = Field(min_length=1, max_length=2000)
    return_to_service: bool = True


class FailureOut(FailureIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    equipment_id: int
    resolved_on: date | None
    downtime_hours: float | None
    resolution: str


class OpenFailure(FailureOut):
    equipment_tag: str
    equipment_name: str


# ---------- Dashboard ----------
class CategoryDowntime(BaseModel):
    category: Category
    hours: float


class Dashboard(BaseModel):
    today: date
    total: int
    out_of_service: int
    overdue: int
    due_soon: int
    open_failures: int
    upcoming: list[EquipmentOut]  # overdue first, then due within 30 days
    failures: list[OpenFailure]  # unresolved, newest first
    downtime_by_category: list[CategoryDowntime]  # last 365 days
