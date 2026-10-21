import type {
  Dashboard,
  Equipment,
  EquipmentDetail,
  EquipmentFilters,
  EquipmentInput,
  EquipmentStatus,
  Failure,
  Inspection,
  InspectionResult,
  Severity,
} from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    // FastAPI puts a readable message in `detail` (a string, or a list for validation errors).
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { loc: string[]; msg: string }) => `${d.loc.at(-1)}: ${d.msg}`).join("; ")
          : `Request failed (${res.status})`,
    );
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

function query(params: object): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : "";
}

const send = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  dashboard: () => request<Dashboard>("/api/dashboard"),
  equipment: (filters: EquipmentFilters = {}) =>
    request<Equipment[]>(`/api/equipment${query(filters)}`),
  locations: () => request<string[]>("/api/equipment/locations"),
  get: (id: number) => request<EquipmentDetail>(`/api/equipment/${id}`),
  create: (data: EquipmentInput) => request<EquipmentDetail>("/api/equipment", send("POST", data)),
  setStatus: (id: number, status: EquipmentStatus) =>
    request<EquipmentDetail>(`/api/equipment/${id}`, send("PATCH", { status })),
  inspections: (id: number) => request<Inspection[]>(`/api/equipment/${id}/inspections`),
  logInspection: (
    id: number,
    data: { date: string; inspector: string; result: InspectionResult; notes: string },
  ) => request<Inspection>(`/api/equipment/${id}/inspections`, send("POST", data)),
  failures: (id: number) => request<Failure[]>(`/api/equipment/${id}/failures`),
  reportFailure: (
    id: number,
    data: { reported_on: string; description: string; severity: Severity },
  ) => request<Failure>(`/api/equipment/${id}/failures`, send("POST", data)),
  resolveFailure: (
    id: number,
    data: {
      resolved_on: string;
      downtime_hours: number;
      resolution: string;
      return_to_service: boolean;
    },
  ) => request<Failure>(`/api/failures/${id}/resolve`, send("POST", data)),
};
