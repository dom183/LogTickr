interface LogoProps {
  size?: "sm" | "md" | "lg"
  variant?: "full" | "icon"
  className?: string
}

export function Logo({ size = "md", variant = "full", className = "" }: LogoProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  }

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* LT Icon */}
      <div className={`${sizeClasses[size]} bg-primary rounded-lg flex items-center justify-center shadow-lg`}>
        <span className="text-primary-foreground font-bold text-sm">LT</span>
      </div>

      {/* Full text logo */}
      {variant === "full" && (
        <span className={`${textSizeClasses[size]} font-bold text-primary tracking-tight`}>LogTickr</span>
      )}
    </div>
  )
}
