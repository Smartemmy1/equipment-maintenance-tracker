// Shapes returned by the FastAPI backend (see backend/app/schemas.py).

export type Category =
  | "pump"
  | "compressor"
  | "separator"
  | "heat_exchanger"
  | "valve"
  | "generator"
  | "tank";
export type Criticality = "high" | "medium" | "low";
export type EquipmentStatus = "in_service" | "out_of_service";
export type InspectionState = "overdue" | "due_soon" | "ok";
export type InspectionResult = "pass" | "pass_with_findings" | "fail";
export type Severity = "minor" | "major" | "critical";

export interface Equipment {
  id: number;
  tag: string;
  name: string;
  category: Category;
  location: string;
  criticality: Criticality;
  status: EquipmentStatus;
  inspection_interval_days: number;
  installed_on: string;
  notes: string;
  last_inspection: string | null;
  next_inspection_due: string;
  days_until_due: number;
  inspection_state: InspectionState;
  open_failures: number;
}

export interface EquipmentDetail extends Equipment {
  metrics: {
    failure_count: number;
    mtbf_days: number | null;
    mttr_hours: number | null;
    availability: number;
  };
}

export interface EquipmentInput {
  tag: string;
  name: string;
  category: Category;
  location: string;
  criticality: Criticality;
  inspection_interval_days: number;
  installed_on: string;
  notes: string;
}

export interface Inspection {
  id: number;
  equipment_id: number;
  date: string;
  inspector: string;
  result: InspectionResult;
  notes: string;
}

export interface Failure {
  id: number;
  equipment_id: number;
  reported_on: string;
  description: string;
  severity: Severity;
  resolved_on: string | null;
  downtime_hours: number | null;
  resolution: string;
}

export interface OpenFailure extends Failure {
  equipment_tag: string;
  equipment_name: string;
}

export interface Dashboard {
  today: string;
  total: number;
  out_of_service: number;
  overdue: number;
  due_soon: number;
  open_failures: number;
  upcoming: Equipment[];
  failures: OpenFailure[];
  downtime_by_category: { category: Category; hours: number }[];
}

export interface EquipmentFilters {
  q?: string;
  category?: string;
  location?: string;
  equipment_status?: string;
  inspection?: string;
}
