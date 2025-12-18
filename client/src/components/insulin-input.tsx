import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { InsulinRegimen, InsulinType } from "@shared/schema";
import { insulinTypes } from "@shared/schema";

interface InsulinInputProps {
  regimens: InsulinRegimen[];
  onRegimensChange: (regimens: InsulinRegimen[]) => void;
}

const insulinCategoryLabels: Record<InsulinType, string> = {
  NPH: "NPH (Intermediária)",
  Regular: "Regular (Rápida)",
  Lispro: "Lispro (Ultrarrápida)",
  Asparte: "Asparte (Ultrarrápida)",
  Glulisina: "Glulisina (Ultrarrápida)",
  Glargina: "Glargina (Longa)",
  Detemir: "Detemir (Longa)",
  Degludeca: "Degludeca (Ultralonga)",
};

export function InsulinInput({ regimens, onRegimensChange }: InsulinInputProps) {
  const addRegimen = () => {
    onRegimensChange([
      ...regimens,
      { type: "NPH", doseManhaUI: 0, doseAlmocoUI: 0, doseJantarUI: 0, doseDormirUI: 0 },
    ]);
  };

  const removeRegimen = (index: number) => {
    onRegimensChange(regimens.filter((_, i) => i !== index));
  };

  const updateRegimen = (
    index: number,
    field: keyof InsulinRegimen,
    value: string | InsulinType
  ) => {
    const newRegimens = [...regimens];
    if (field === "type") {
      newRegimens[index] = { ...newRegimens[index], type: value as InsulinType };
    } else {
      const numValue = value === "" ? 0 : parseFloat(value as string);
      newRegimens[index] = { ...newRegimens[index], [field]: numValue };
    }
    onRegimensChange(newRegimens);
  };

  const calculateTotalDose = (regimen: InsulinRegimen): number => {
    return (
      (regimen.doseManhaUI || 0) +
      (regimen.doseAlmocoUI || 0) +
      (regimen.doseJantarUI || 0) +
      (regimen.doseDormirUI || 0)
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Esquema de Insulina</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRegimen}
          data-testid="button-add-insulin"
        >
          <Plus className="mr-1 h-4 w-4" />
          Adicionar Insulina
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {regimens.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p>Nenhuma insulina configurada.</p>
            <p className="text-sm mt-1">Clique em "Adicionar Insulina" para configurar.</p>
          </div>
        ) : (
          regimens.map((regimen, index) => (
            <div key={index} className="relative border border-border rounded-md p-4">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex-1 max-w-xs">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                    Tipo de Insulina
                  </Label>
                  <Select
                    value={regimen.type}
                    onValueChange={(value) => updateRegimen(index, "type", value)}
                  >
                    <SelectTrigger data-testid={`select-insulin-type-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {insulinTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {insulinCategoryLabels[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRegimen(index)}
                  className="text-destructive mt-6"
                  data-testid={`button-remove-insulin-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Manhã (UI)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={regimen.doseManhaUI || ""}
                    onChange={(e) => updateRegimen(index, "doseManhaUI", e.target.value)}
                    className="font-mono"
                    data-testid={`input-insulin-manha-${index}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Almoço (UI)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={regimen.doseAlmocoUI || ""}
                    onChange={(e) => updateRegimen(index, "doseAlmocoUI", e.target.value)}
                    className="font-mono"
                    data-testid={`input-insulin-almoco-${index}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Jantar (UI)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={regimen.doseJantarUI || ""}
                    onChange={(e) => updateRegimen(index, "doseJantarUI", e.target.value)}
                    className="font-mono"
                    data-testid={`input-insulin-jantar-${index}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Dormir (UI)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={regimen.doseDormirUI || ""}
                    onChange={(e) => updateRegimen(index, "doseDormirUI", e.target.value)}
                    className="font-mono"
                    data-testid={`input-insulin-dormir-${index}`}
                  />
                </div>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                Dose total diária: <span className="font-mono font-semibold text-foreground">{calculateTotalDose(regimen)} UI</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
