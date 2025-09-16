import Link from "next/link";
import { Menu, Plus } from "lucide-react";
import { Button } from "./ui/button";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold text-foreground transition hover:text-primary"
        >
          {/* <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Train className="h-5 w-5" aria-hidden="true" />
          </span> */}
          <span className="hidden sm:inline">Vonatok.vercel.app</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-muted-foreground"
            aria-label="Toggle navigation"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
          <Button asChild size="sm">
            <Link href="/train/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">New Train</span>
              <span className="sm:hidden">Create</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
