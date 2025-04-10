import Link from "next/link";
import { Plus, Train } from "lucide-react";
import { Button } from "./ui/button";

export function Header() {
  return (
    <header className="bg-primary text-primary-foreground py-4">
      <div className="container mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center space-x-2 text-xl font-bold"
        >
          <Train size={24} />
          {/* <span>Jobb Menetrendek</span> */}
        </Link>
        {/* <nav>
          <ul className="flex space-x-4">
            <li>
              <Link href="/" className="hover:underline">
                Home
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:underline">
                About
              </Link>
            </li>
          </ul>
        </nav> */}
        <Link href="/train/new">
          <Button>
            New Train <Plus />
          </Button>
        </Link>
      </div>
    </header>
  );
}
