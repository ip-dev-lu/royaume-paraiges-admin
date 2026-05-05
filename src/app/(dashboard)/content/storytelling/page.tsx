"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Pencil, BookOpen } from "lucide-react";
import { getLevelThresholds, getXpPerEuro, updateLevelThreshold } from "@/lib/services/contentService";
import type { LevelThreshold } from "@/lib/services/contentService";
import { levelToCoefficient, levelToRankName } from "@/lib/services/levelService";
import { useToast } from "@/components/ui/use-toast";

export default function StorytellingPage() {
  const { toast } = useToast();
  const [levels, setLevels] = useState<LevelThreshold[]>([]);
  const [xpPerEuro, setXpPerEuro] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [editingLevel, setEditingLevel] = useState<LevelThreshold | null>(null);
  const [loreText, setLoreText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [data, ratio] = await Promise.all([
          getLevelThresholds(),
          getXpPerEuro(),
        ]);
        setLevels(data);
        setXpPerEuro(ratio);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger les niveaux",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);

  const handleSave = async () => {
    if (!editingLevel) return;
    setSaving(true);
    try {
      await updateLevelThreshold(editingLevel.id, { lore: loreText || null });
      setLevels((prev) =>
        prev.map((l) =>
          l.id === editingLevel.id ? { ...l, lore: loreText || null } : l
        )
      );
      toast({ title: "Lore mis à jour" });
      setEditingLevel(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de modifier le lore",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Storytelling</h1>
        <p className="text-muted-foreground">
          Gérez les textes narratifs affichés sur la homepage selon le niveau du joueur
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Lore par niveau
          </CardTitle>
          <CardDescription>
            Chaque joueur voit le texte correspondant à son niveau actuel sur la homepage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Niv.</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead className="w-[120px]">Rang</TableHead>
                <TableHead className="w-[100px] text-right">XP requis</TableHead>
                <TableHead className="w-[100px] text-right">Δ XP</TableHead>
                <TableHead className="w-[110px] text-right">Équiv. €</TableHead>
                <TableHead className="w-[110px] text-right">Coef. PdB</TableHead>
                <TableHead>Lore</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {levels.map((level, index) => {
                const previousXp = index > 0 ? (levels[index - 1]?.xp_required ?? 0) : 0;
                const xpDelta = level.xp_required - previousXp;
                const equivalentEuros = xpPerEuro > 0 ? level.xp_required / xpPerEuro : 0;
                return (
                <TableRow key={level.id}>
                  <TableCell className="font-bold">{level.level}</TableCell>
                  <TableCell className="font-medium">{level.name}</TableCell>
                  <TableCell className="text-muted-foreground">{levelToRankName(level.level)}</TableCell>
                  <TableCell className="text-right tabular-nums">{level.xp_required.toLocaleString("fr-FR")}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {index === 0 ? "—" : `+${xpDelta.toLocaleString("fr-FR")}`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {equivalentEuros.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    × {levelToCoefficient(level.level).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </TableCell>
                  <TableCell className="max-w-[400px] truncate text-muted-foreground">
                    {level.lore || <span className="italic">Aucun lore</span>}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingLevel(level);
                        setLoreText(level.lore || "");
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingLevel} onOpenChange={(open) => !open && setEditingLevel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Modifier le lore du niveau {editingLevel?.level} — {editingLevel?.name}
            </DialogTitle>
            <DialogDescription>
              Ce texte sera affiché sur la homepage pour les joueurs de ce niveau
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={loreText}
            onChange={(e) => setLoreText(e.target.value)}
            placeholder="Ex: Bienvenue dans le Royaume, jeune aventurier..."
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLevel(null)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
