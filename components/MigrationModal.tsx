"use client";

import { useState, useEffect } from "react";
import { Button } from "@heroui/react";
import { motion } from "framer-motion";
import { ArrowRight, Database, Trash2 } from "lucide-react";
import { detectExistingData, migrateAllData, clearLocalData, getLocalDataSummary } from "@/lib/migrate-data";

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
  const [summary, setSummary] = useState<string[]>([]);
  const [stats, setStats] = useState({ exercises: 0, exams: 0, prep: 0 });

  useEffect(() => {
    if (open) {
      const data = detectExistingData();
      setStats(data.stats);
      if (data.hasData) {
        setSummary(getLocalDataSummary());
      }
    }
  }, [open]);

  if (!open) return null;

  const handleImport = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await migrateAllData();
      clearLocalData();
      setStats({ exercises: 0, exams: 0, prep: 0 });
      setSummary([]);
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Migration failed");
      setLoading(false);
    }
  };

  const handleSkip = () => {
    clearLocalData();
    onComplete();
  };

  const handleDone = () => {
    setLoading(false);
    setDone(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div
        className="bg-background rounded-xl border shadow-2xl p-6 w-full max-w-md mx-4"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {done ? (
          <>
            <div className="text-center mb-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <Database className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
              </motion.div>
              <h2 className="text-lg font-semibold">Data imported!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                All your progress is now in your account.
              </p>
            </div>
            <Button variant="primary" size="sm" className="w-full" onPress={handleDone}>
              Continue
            </Button>
          </>
        ) : (
          <>
            <div className="text-center mb-4">
              <Database className="h-10 w-10 text-primary mx-auto mb-2" />
              <h2 className="text-lg font-semibold">We found your progress</h2>
              <p className="text-sm text-muted-foreground mt-1">
                You have data from using the platform without an account.
              </p>
            </div>

            {summary.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-3 mb-4 text-sm space-y-1">
                {summary.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {s}
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

            <div className="space-y-2">
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onPress={handleImport}
                isDisabled={loading}
              >
                {loading ? "Importing..." : (
                  <>
                    Import to my account
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </>
                )}
              </Button>
              <button
                onClick={handleSkip}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1 py-1"
                disabled={loading}
              >
                <Trash2 className="h-3 w-3" />
                Start fresh — don't import
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
