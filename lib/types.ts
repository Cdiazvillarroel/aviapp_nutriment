// Hand-rolled types matching the schema in supabase/migrations/0001_init.sql.
//
// Once you start changing the schema, replace this with auto-generated types:
//   supabase gen types typescript --project-ref <ref> > lib/database.types.ts
// and import { Database } from "./database.types".

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus   = "open" | "acknowledged" | "resolved" | "dismissed";
export type AlertSource   = "ai_predictive" | "rule_engine" | "manual" | "overdue";

export type VisitType   = "routine" | "sanitary" | "post_mortem" | "audit";
export type VisitStatus = "planned" | "in_progress" | "completed" | "cancelled";

export type MemberRole = "admin" | "vet" | "tech" | "producer";
export type ComplexKind = "rspca" | "free_range" | "conventional";

export interface Alert {
  id: string;
  client_id: string;
  farm_id: string | null;
  flock_id: string | null;
  severity: AlertSeverity;
  status: AlertStatus;
  source: AlertSource;
  title: string;
  body: string | null;
  detected_at: string;
  resolved_at: string | null;
}

export interface Visit {
  id: string;
  client_id: string;
  farm_id: string;
  scheduled_at: string;
  type: VisitType;
  status: VisitStatus;
  technician_id: string | null;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  // joined
  farms?: { name: string } | null;
}

export interface Farm {
  id: string;
  client_id: string;
  name: string;
  reference_id: string | null;
  complex_id: string | null;
  region_id: string | null;
}

export interface ClientMembership {
  client_id: string;
  user_id: string;
  role: MemberRole;
  display_name: string | null;
  clients: { id: string; name: string; slug: string };
}
