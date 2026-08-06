"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { motion } from "framer-motion";
import { Database, Trash2, CheckCircle2 } from "lucide-react";
import { migrateAllData, markMigrationHandled, getLocalDataSummary } from "@/lib/migrate-data";

export default function MigrationModal({
  open,
  onComplete,
}: {
  open: boolean;
  onComplete: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // The parent only mounts this component while `open` is true (see
  // AuthDialog.tsx: `{showMigration && <MigrationModal .../>}`), so this
  // only ever needs to compute once at mount, not react to `open` changing.
  const [summary] = useState(() => (typeof window !== "undefined" ? getLocalDataSummary() : []));

  if (!open) return null;

  const handleImport = async () => {
    setLoading(true);
    setError("");
    try {
      // migrateAllData() marks the prompt as handled internally on success —
      // local progress/code stays intact (the app reads it from localStorage
      // and it's now also synced to the account), it just won't be offered
      // for import again.
      await migrateAllData();
      setDone(true);
      setLoading(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Migration failed");
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // "Start fresh" means don't sync local progress to this account and
    // don't ask again — it does NOT mean delete the user's solved exercises
    // and code, which is what this used to do.
    markMigrationHandled();
    onComplete();
  };

  const handleDone = () => {
    setDone(false);
    setLoading(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        className="bg-background rounded-xl border shadow-2xl p-6 w-full max-w-md mx-4"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {done ? (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            </motion.div>
            <h2 className="text-lg font-semibold mb-1">Data imported!</h2>
            <p className="text-sm text-muted-foreground mb-5">
              All your progress is now saved to your account. Access it from any device.
            </p>
            <Button variant="primary" size="sm" className="w-full" onPress={handleDone}>
              Continue
            </Button>
          </div>
        ) : (
          <>
            <div className="text-center mb-4">
              <Database className="h-10 w-10 text-primary mx-auto mb-2" />
              <h2 className="text-lg font-semibold">We found your progress</h2>
              <p className="text-sm text-muted-foreground mt-1">
                You used the platform before. Import everything to your account or start fresh.
              </p>
            </div>

            {summary.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-3 mb-4 text-sm space-y-1.5">
                {summary.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    {s}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p className="text-xs text-red-500 mb-3 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="space-y-2">
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onPress={handleImport}
                isDisabled={loading}
              >
                {loading ? "Importing..." : "Import to my account"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onPress={handleSkip}
                isDisabled={loading}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Start fresh — don&apos;t import
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
