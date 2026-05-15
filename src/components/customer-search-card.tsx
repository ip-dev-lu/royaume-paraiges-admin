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
import { Input } from "@/components/ui/input";
import { Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { searchCustomers } from "@/lib/services/couponService";
import type { Profile } from "@/types/database";

interface CustomerSearchCardProps {
  customerId: string;
  customerName: string;
  onSelect: (customer: Profile) => void;
  onClear: () => void;
  error?: string;
  description?: string;
}

export function CustomerSearchCard({
  customerId,
  customerName,
  onSelect,
  onClear,
  error,
  description = "Recherchez et sélectionnez le destinataire.",
}: CustomerSearchCardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery.length >= 3) {
        setSearching(true);
        searchCustomers(searchQuery)
          .then((results) => setSearchResults(results || []))
          .catch(() =>
            toast.error("Erreur", {
              description: "Erreur lors de la recherche",
            }),
          )
          .finally(() => setSearching(false));
      } else if (searchQuery.length === 0) {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleSelect = (customer: Profile) => {
    onSelect(customer);
    setSearchResults([]);
    setSearchQuery("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Utilisateur</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {customerId ? (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{customerName}</p>
                <p className="text-sm text-muted-foreground">
                  ID: {customerId.slice(0, 8)}...
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClear}
            >
              Changer
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Input
                placeholder="Rechercher par nom ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="rounded-lg border">
                {searchResults.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    className="flex w-full items-center gap-3 border-b p-3 text-left last:border-b-0 hover:bg-accent"
                    onClick={() => handleSelect(customer)}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {`${customer.first_name || ""} ${
                          customer.last_name || ""
                        }`.trim() || "Sans nom"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {customer.email}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
