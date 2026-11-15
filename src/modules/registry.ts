import {
  BarChart3,
  Calculator,
  FolderKanban,
  HandCoins,
  LayoutDashboard,
  Receipt,
  Scale,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

// سجل الوحدات: المصدر الوحيد للتنقل.
// لإضافة وحدة جديدة: أنشئ src/modules/<name>/ وصفحاتها تحت src/app/(app)/<name>/
// ثم أضف سطراً هنا. لا شيء آخر في القالب يحتاج تعديلاً.

export type ModuleGroup = "main" | "finance" | "work" | "system";

export type ModuleDef = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  group: ModuleGroup;
};

export const GROUP_LABELS: Record<ModuleGroup, string | null> = {
  main: null,
  finance: "المالية",
  work: "الأعمال",
  system: "النظام",
};

export const MODULES: ModuleDef[] = [
  { id: "dashboard", label: "لوحة القيادة", href: "/", icon: LayoutDashboard, group: "main" },

  { id: "expenses", label: "المصروفات", href: "/expenses", icon: Receipt, group: "finance" },
  { id: "revenue", label: "الإيرادات", href: "/revenue", icon: HandCoins, group: "finance" },
  { id: "partners", label: "الشركاء والخزينة", href: "/partners", icon: Scale, group: "finance" },
  { id: "reports", label: "التقارير", href: "/reports", icon: BarChart3, group: "finance" },

  { id: "pricing", label: "التسعير", href: "/pricing", icon: Calculator, group: "work" },
  { id: "projects", label: "المشاريع", href: "/projects", icon: FolderKanban, group: "work" },
  { id: "clients", label: "العملاء", href: "/clients", icon: Users, group: "work" },

  { id: "settings", label: "الإعدادات", href: "/settings", icon: Settings, group: "system" },
];
