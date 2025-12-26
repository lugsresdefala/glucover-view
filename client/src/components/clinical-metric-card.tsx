import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info } from "lucide-react";

type UrgencyLevel = "info" | "success" | "warning" | "critical";
type TrendDirection = "up" | "down" | "stable";

interface ClinicalMetricCardProps {
  label: string;
  value: number | string;
  target?: string;
  unit?: string;
  trend?: {
    direction: TrendDirection;
    delta?: number | string;
    label?: string;
  };
  urgency?: UrgencyLevel;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

const urgencyStyles: Record<UrgencyLevel, { bg: string; badge: string; icon: React.ReactNode }> = {
  info: {
    bg: "bg-status-info-bg",
    badge: "bg-status-info text-status-info-foreground",
    icon: <Info className="h-4 w-4" />,
  },
  success: {
    bg: "bg-status-success-bg",
    badge: "bg-status-success text-status-success-foreground",
    icon: <CheckCircle className="h-4 w-4" />,
  },
  warning: {
    bg: "bg-status-warning-bg",
    badge: "bg-status-warning text-status-warning-foreground",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  critical: {
    bg: "bg-status-critical-bg",
    badge: "bg-status-critical text-status-critical-foreground",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
};

const trendIcons: Record<TrendDirection, React.ReactNode> = {
  up: <TrendingUp className="h-4 w-4" />,
  down: <TrendingDown className="h-4 w-4" />,
  stable: <Minus className="h-4 w-4" />,
};

export function ClinicalMetricCard({
  label,
  value,
  target,
  unit = "",
  trend,
  urgency = "info",
  icon,
  footer,
  className = "",
}: ClinicalMetricCardProps) {
  const styles = urgencyStyles[urgency];

  return (
    <Card className={`relative overflow-visible ${className}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div className="space-y-1">
          <p className="text-caption">{label}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${styles.bg}`}>
          {icon || styles.icon}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-metric" data-testid={`metric-value-${label.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </span>
          {unit && (
            <span className="text-label">{unit}</span>
          )}
        </div>

        {target && (
          <div className="flex items-center gap-2">
            <span className="text-target">Meta: {target}</span>
            {urgency === "success" && (
              <Badge variant="outline" className="text-xs bg-status-success-bg text-status-success border-status-success/20">
                Na meta
              </Badge>
            )}
            {urgency === "warning" && (
              <Badge variant="outline" className="text-xs bg-status-warning-bg text-status-warning-foreground border-status-warning/20">
                Atenção
              </Badge>
            )}
            {urgency === "critical" && (
              <Badge variant="outline" className="text-xs bg-status-critical-bg text-status-critical border-status-critical/20">
                Fora da meta
              </Badge>
            )}
          </div>
        )}

        {trend && (
          <div className="flex items-center gap-2 pt-1 border-t border-border/50">
            <span className={`flex items-center gap-1 text-sm font-medium ${
              trend.direction === "down" ? "text-status-success" :
              trend.direction === "up" ? "text-status-warning" :
              "text-muted-foreground"
            }`}>
              {trendIcons[trend.direction]}
              {trend.delta && (
                <span>{trend.delta}</span>
              )}
            </span>
            {trend.label && (
              <span className="text-xs text-muted-foreground">{trend.label}</span>
            )}
          </div>
        )}

        {footer && (
          <div className="pt-2 border-t border-border/50">
            {footer}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MetricComparisonProps {
  current: number | string;
  target: number | string;
  unit?: string;
  isInRange?: boolean;
}

export function MetricComparison({ current, target, unit = "mg/dL", isInRange }: MetricComparisonProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-1">
        <p className="text-caption">Atual</p>
        <p className={`text-metric-sm ${isInRange ? "text-status-success" : "text-status-critical"}`}>
          {current} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
        </p>
      </div>
      <div className="h-8 w-px bg-border" />
      <div className="space-y-1">
        <p className="text-caption">Meta</p>
        <p className="text-metric-sm text-muted-foreground">
          {target} <span className="text-sm font-normal">{unit}</span>
        </p>
      </div>
    </div>
  );
}
