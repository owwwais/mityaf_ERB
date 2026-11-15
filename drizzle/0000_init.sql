CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"weekly_hours" numeric(8, 2) DEFAULT 15 NOT NULL,
	"hourly_cost" numeric(14, 2) DEFAULT 100 NOT NULL,
	"profit_share_pct" numeric(6, 2) DEFAULT 50 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"company_name" text DEFAULT 'مطياف' NOT NULL,
	"currency" text DEFAULT 'ر.س' NOT NULL,
	"monthly_revenue_target" numeric(14, 2) DEFAULT 5000 NOT NULL,
	"monthly_expense_cap" numeric(14, 2) DEFAULT 1000 NOT NULL,
	"treasury_pct" numeric(6, 2) DEFAULT 20 NOT NULL,
	"finder_pct" numeric(6, 2) DEFAULT 20 NOT NULL,
	"executor_pct" numeric(6, 2) DEFAULT 60 NOT NULL,
	"target_margin_pct" numeric(6, 2) DEFAULT 30 NOT NULL,
	"min_margin_pct" numeric(6, 2) DEFAULT 30 NOT NULL,
	"default_risk_pct" numeric(6, 2) DEFAULT 15 NOT NULL,
	"down_payment_pct" numeric(6, 2) DEFAULT 50 NOT NULL,
	"meter_opening_fee" numeric(14, 2) DEFAULT 100 NOT NULL,
	"meter_hourly_rate" numeric(14, 2) DEFAULT 150 NOT NULL,
	"vat_enabled" boolean DEFAULT false NOT NULL,
	"vat_pct" numeric(6, 2) DEFAULT 15 NOT NULL,
	"quote_validity_days" integer DEFAULT 14 NOT NULL,
	"quote_terms" text DEFAULT 'دفعة مقدمة عند التعاقد والباقي عند التسليم. أي طلب خارج النطاق المذكور يُسعَّر بشكل مستقل.' NOT NULL,
	"working_weeks" integer DEFAULT 48 NOT NULL,
	"utilization_pct" numeric(6, 2) DEFAULT 60 NOT NULL,
	"hours_overrun_alert_pct" numeric(6, 2) DEFAULT 20 NOT NULL,
	"client_concentration_alert_pct" numeric(6, 2) DEFAULT 50 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"partner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"sector" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'direct' NOT NULL,
	"stage" text DEFAULT 'new' NOT NULL,
	"expected_value" numeric(14, 2) DEFAULT 0 NOT NULL,
	"interest" text DEFAULT '' NOT NULL,
	"need" text DEFAULT '' NOT NULL,
	"next_step" text DEFAULT '' NOT NULL,
	"follow_up_date" date,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"title" text NOT NULL,
	"client_id" uuid,
	"service_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"inputs" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"price" numeric(14, 2) DEFAULT 0 NOT NULL,
	"total_hours" numeric(8, 2) DEFAULT 0 NOT NULL,
	"total_cost" numeric(14, 2) DEFAULT 0 NOT NULL,
	"margin_pct" numeric(6, 2) DEFAULT 0 NOT NULL,
	"valid_until" date,
	"scope_included" text DEFAULT '' NOT NULL,
	"scope_excluded" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'service' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"base_value" numeric(14, 2) DEFAULT 0 NOT NULL,
	"typical_hours" numeric(8, 2) DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"client_id" uuid,
	"quote_id" uuid,
	"type" text DEFAULT 'joint' NOT NULL,
	"billing" text DEFAULT 'one_time' NOT NULL,
	"finder_id" uuid,
	"executor_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"price" numeric(14, 2) DEFAULT 0 NOT NULL,
	"estimated_hours" numeric(8, 2) DEFAULT 0 NOT NULL,
	"start_date" date,
	"due_date" date,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"date" date NOT NULL,
	"hours" numeric(8, 2) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"category_id" uuid,
	"description" text NOT NULL,
	"vendor" text DEFAULT '' NOT NULL,
	"project_id" uuid,
	"paid_by" uuid,
	"method" text DEFAULT 'transfer' NOT NULL,
	"operating_cost_id" uuid,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operating_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category_id" uuid,
	"amount" numeric(14, 2) NOT NULL,
	"cycle" text DEFAULT 'monthly' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"project_id" uuid,
	"client_id" uuid,
	"kind" text DEFAULT 'down_payment' NOT NULL,
	"received_by" uuid,
	"method" text DEFAULT 'transfer' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"from_partner_id" uuid,
	"to_partner_id" uuid,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_finder_id_partners_id_fk" FOREIGN KEY ("finder_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_executor_id_partners_id_fk" FOREIGN KEY ("executor_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_partners_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_operating_cost_id_operating_costs_id_fk" FOREIGN KEY ("operating_cost_id") REFERENCES "public"."operating_costs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operating_costs" ADD CONSTRAINT "operating_costs_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_partners_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_partner_id_partners_id_fk" FOREIGN KEY ("from_partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_partner_id_partners_id_fk" FOREIGN KEY ("to_partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "time_logs_project_idx" ON "time_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "time_logs_date_idx" ON "time_logs" USING btree ("date");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("date");--> statement-breakpoint
CREATE INDEX "expenses_project_idx" ON "expenses" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "payments_date_idx" ON "payments" USING btree ("date");--> statement-breakpoint
CREATE INDEX "payments_project_idx" ON "payments" USING btree ("project_id");