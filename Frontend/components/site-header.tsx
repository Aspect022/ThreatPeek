"use client"

import Link from "next/link"
import { Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function SiteHeader() {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Shield className="h-8 w-8 text-blue-400 mr-2" />
              <span className="text-white text-xl font-bold">ThreatPeek</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-4 text-gray-300">
            <Link href="#about" className="hover:text-white">
              About
            </Link>
            <Link href="#docs" className="hover:text-white">
              Docs
            </Link>
            <Link href="#blogs" className="hover:text-white">
              Blogs
            </Link>
            <Link href="#contact" className="hover:text-white">
              Contact
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {!isLoading && !user && (
              <Button
                variant="outline"
                className="bg-transparent border-gray-600 text-white hover:bg-gray-800"
                onClick={() => router.push("/login")}
              >
                Login / Sign up
              </Button>
            )}
            {!isLoading && user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label="Open profile menu" className="inline-flex items-center focus:outline-none">
                    <Avatar className="h-9 w-9 ring-1 ring-gray-700">
                      <AvatarFallback className="bg-blue-600 text-white">
                        {(user.name || user.email || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs">
                    Signed in as
                    <div className="text-foreground font-medium truncate">{user.name || user.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/dashboard/scan")}>Dashboard</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/profile")}>Profile</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await logout()
                      router.push("/")
                    }}
                  >
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
