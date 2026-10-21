"""ORM models: Equipment has many Inspections and Failures."""

import enum
from datetime import date

from sqlalchemy import Date, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Category(enum.StrEnum):
    pump = "pump"
    compressor = "compressor"
    separator = "separator"
    heat_exchanger = "heat_exchanger"
    valve = "valve"
    generator = "generator"
    tank = "tank"


class Criticality(enum.StrEnum):
    high = "high"
    medium = "medium"
    low = "low"


class EquipmentStatus(enum.StrEnum):
    in_service = "in_service"
    out_of_service = "out_of_service"


class InspectionResult(enum.StrEnum):
    passed = "pass"
    findings = "pass_with_findings"
    failed = "fail"


class Severity(enum.StrEnum):
    minor = "minor"
    major = "major"
    critical = "critical"


class Equipment(Base):
    __tablename__ = "equipment"

    id: Mapped[int] = mapped_column(primary_key=True)
    tag: Mapped[str] = mapped_column(String(30), unique=True, index=True)  # e.g. P-101A
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[Category] = mapped_column(Enum(Category), index=True)
    location: Mapped[str] = mapped_column(String(120))
    criticality: Mapped[Criticality] = mapped_column(Enum(Criticality), default=Criticality.medium)
    status: Mapped[EquipmentStatus] = mapped_column(
        Enum(EquipmentStatus), default=EquipmentStatus.in_service
    )
    inspection_interval_days: Mapped[int] = mapped_column(Integer)
    installed_on: Mapped[date] = mapped_column(Date)
    notes: Mapped[str] = mapped_column(Text, default="")

    inspections: Mapped[list["Inspection"]] = relationship(
        back_populates="equipment", cascade="all, delete-orphan", order_by="Inspection.date"
    )
    failures: Mapped[list["Failure"]] = relationship(
        back_populates="equipment", cascade="all, delete-orphan", order_by="Failure.reported_on"
    )


class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[int] = mapped_column(primary_key=True)
    equipment_id: Mapped[int] = mapped_column(
        ForeignKey("equipment.id", ondelete="CASCADE"), index=True
    )
    date: Mapped[date] = mapped_column(Date, index=True)
    inspector: Mapped[str] = mapped_column(String(80))
    result: Mapped[InspectionResult] = mapped_column(Enum(InspectionResult))
    notes: Mapped[str] = mapped_column(Text, default="")

    equipment: Mapped[Equipment] = relationship(back_populates="inspections")


class Failure(Base):
    """A breakdown or defect, open until it is resolved."""

    __tablename__ = "failures"

    id: Mapped[int] = mapped_column(primary_key=True)
    equipment_id: Mapped[int] = mapped_column(
        ForeignKey("equipment.id", ondelete="CASCADE"), index=True
    )
    reported_on: Mapped[date] = mapped_column(Date, index=True)
    description: Mapped[str] = mapped_column(Text)
    severity: Mapped[Severity] = mapped_column(Enum(Severity))
    resolved_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    downtime_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    resolution: Mapped[str] = mapped_column(Text, default="")

    equipment: Mapped[Equipment] = relationship(back_populates="failures")
