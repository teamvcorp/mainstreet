"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  StoreIcon,
  Package,
  ShoppingBag,
  CreditCard,
  CalendarDays,
  BadgeCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/seller", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/seller/store", label: "Store profile", icon: StoreIcon },
  { href: "/seller/products", label: "Products", icon: Package },
  { href: "/seller/orders", label: "Orders", icon: ShoppingBag },
  { href: "/seller/connect", label: "Payouts", icon: CreditCard },
  { href: "/seller/events", label: "Events", icon: CalendarDays },
  { href: "/seller/membership", label: "Membership", icon: BadgeCheck },
];

export function SellerSidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
