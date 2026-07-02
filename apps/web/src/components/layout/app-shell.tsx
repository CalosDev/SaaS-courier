"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  MapPinned,
  PackageSearch,
  ShieldCheck,
  Users,
  Warehouse,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth/auth-provider";
import { hasEveryPermission, type PermissionCode } from "@/lib/permissions";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermissions: PermissionCode[];
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    requiredPermissions: ["organizations.read"],
  },
  {
    href: "/organization",
    label: "Organización",
    icon: Building2,
    requiredPermissions: ["organizations.read"],
  },
  {
    href: "/onboarding",
    label: "Onboarding",
    icon: ClipboardCheck,
    requiredPermissions: ["organizations.read"],
  },
  {
    href: "/facilities",
    label: "Facilities",
    icon: Warehouse,
    requiredPermissions: ["facilities.read"],
  },
  {
    href: "/employees",
    label: "Empleados",
    icon: Users,
    requiredPermissions: ["employees.read"],
  },
  {
    href: "/roles",
    label: "Roles",
    icon: ShieldCheck,
    requiredPermissions: ["roles.read"],
  },
  {
    href: "/customers",
    label: "Clientes",
    icon: MapPinned,
    requiredPermissions: ["customers.read"],
  },
  {
    href: "/customer-imports",
    label: "Importaciones",
    icon: PackageSearch,
    requiredPermissions: ["customers.read"],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, logout } = useAuth();
  const pathname = usePathname();

  if (state.status !== "authenticated") {
    return null;
  }

  const visibleItems = NAV_ITEMS.filter((item) =>
    hasEveryPermission(state.permissionCodes, item.requiredPermissions),
  );

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <strong>{process.env.NEXT_PUBLIC_APP_NAME || "Courier SaaS"}</strong>
          <span>{state.session.organizationName}</span>
        </div>

        <nav className="app-shell__nav" aria-label="Navegación principal">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const selected =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("app-shell__nav-link", selected && "is-active")}
              >
                <Icon className="app-shell__nav-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="app-shell__content">
        <header className="app-shell__header">
          <div>
            <strong>{state.session.firstName} {state.session.lastName}</strong>
            <p>{state.session.email}</p>
          </div>
          <Button variant="secondary" onClick={() => void logout()}>
            <LogOut className="button-icon" />
            <span>Cerrar sesión</span>
          </Button>
        </header>
        <main className="app-shell__main">{children}</main>
      </div>
    </div>
  );
}
