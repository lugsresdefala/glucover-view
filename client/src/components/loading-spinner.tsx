import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export function LoadingSpinner({ size = "md", text }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3" data-testid="loading-spinner">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

export function FullPageLoading({ text = "Carregando..." }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

export function AnalyzingLoading() {
  return (
    <div className="flex flex-col items-center justify-center p-8 gap-4">
      <div className="relative">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full bg-primary/20 animate-pulse" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-lg font-medium">Analisando dados clínicos...</p>
        <p className="text-sm text-muted-foreground mt-1">
          Gerando recomendações baseadas nas diretrizes SBD 2025, FEBRASGO 2019 e OMS 2025
        </p>
      </div>
    </div>
  );
}
