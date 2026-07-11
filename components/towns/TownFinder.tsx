"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LocateFixed, Search, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TownCard } from "@/components/towns/TownCard";
import type { TownListItem } from "@/lib/towns";
import { useT } from "@/components/i18n/I18nProvider";

interface Origin {
  lat: number;
  lng: number;
  label: string;
}

const RADIUS_PRESETS = [25, 50, 100, 150];
const MIN_RADIUS = 10;
const MAX_RADIUS = 250;

export function TownFinder({ initialTowns }: { initialTowns: TownListItem[] }) {
  const t = useT();
  const [towns, setTowns] = useState<TownListItem[]>(initialTowns);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [radius, setRadius] = useState(50);
  const [zip, setZip] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNearby = useCallback(async (lat: number, lng: number, miles: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/towns?lat=${lat}&lng=${lng}&radius=${miles}`);
      if (!res.ok) throw new Error("Could not load nearby towns.");
      const data = await res.json();
      setTowns(data.towns ?? []);
    } catch {
      setError("Something went wrong loading nearby towns.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-query when the radius slider moves (debounced), if we have an origin.
  useEffect(() => {
    if (!origin) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchNearby(origin.lat, origin.lng, radius);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [radius, origin, fetchNearby]);

  function useMyLocation() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Your browser doesn't support location sharing. Try a ZIP code instead.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "your location",
        };
        setOrigin(next);
        void fetchNearby(next.lat, next.lng, radius);
      },
      () => {
        setLoading(false);
        setError("We couldn't get your location. Enter a ZIP code instead.");
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  async function submitZip(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{5}$/.test(zip)) {
      setError("Enter a valid 5-digit ZIP code.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/geo/zip?zip=${zip}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "We couldn't look up that ZIP.");
        setLoading(false);
        return;
      }
      const label = data.city ? `${data.city}, ${data.state}` : `ZIP ${zip}`;
      const next = { lat: data.lat, lng: data.lng, label };
      setOrigin(next);
      void fetchNearby(next.lat, next.lng, radius);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  function clearLocation() {
    setOrigin(null);
    setZip("");
    setError(null);
    setTowns(initialTowns);
  }

  return (
    <div>
      {/* Controls */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium">{t("towns.findNear")}</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="default" onClick={useMyLocation} disabled={loading}>
                <LocateFixed className="size-4" /> {t("towns.shareLocation")}
              </Button>
              <form onSubmit={submitZip} className="flex flex-1 gap-2">
                <Input
                  inputMode="numeric"
                  pattern="\d{5}"
                  maxLength={5}
                  placeholder={t("towns.zipPlaceholder")}
                  value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
                  aria-label="ZIP code"
                />
                <Button type="submit" variant="outline" disabled={loading}>
                  <Search className="size-4" /> {t("towns.go")}
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Radius slider */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <label htmlFor="radius" className="text-sm font-medium">
              {t("towns.searchArea")}
            </label>
            <span className="text-sm font-semibold text-accent-foreground">
              {t("towns.within")} {radius} {t("towns.miles")}
            </span>
          </div>
          <input
            id="radius"
            type="range"
            min={MIN_RADIUS}
            max={MAX_RADIUS}
            step={5}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-accent"
            aria-valuetext={`${radius} miles`}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {RADIUS_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRadius(preset)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  radius === preset
                    ? "border-accent bg-accent/15 text-accent-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {preset} mi
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status row */}
      <div className="mt-6 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> {t("towns.searching")}
            </span>
          ) : origin ? (
            <>
              <span className="font-medium text-foreground">{towns.length}</span>{" "}
              {towns.length === 1 ? t("towns.town") : t("towns.towns")} {t("towns.within")} {radius}{" "}
              {t("towns.milesOf")} <span className="font-medium text-foreground">{origin.label}</span>
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">{towns.length}</span>{" "}
              {towns.length === 1 ? t("towns.town") : t("towns.towns")} {t("towns.onMainStreet")}
            </>
          )}
        </p>
        {origin && (
          <button
            type="button"
            onClick={clearLocation}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" /> {t("common.clear")}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {/* Results */}
      {towns.length > 0 ? (
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {towns.map((town) => (
            <TownCard key={town.id} town={town} />
          ))}
        </div>
      ) : (
        !loading && (
          <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
            <p className="font-serif text-lg">{t("towns.noneTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("towns.noneBody")}</p>
          </div>
        )
      )}
    </div>
  );
}
