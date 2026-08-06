"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

export default function AuthErrorPage() {
  return (
    <motion.div
      className="max-w-lg mx-auto px-4 py-16 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
    >
      <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
      <h1 className="text-xl font-bold mb-2">Link expired or already used</h1>
      <p className="text-sm text-muted-foreground mb-6">
        That confirmation link is no longer valid — it may have expired or already been used.
        Try signing up or signing in again to get a fresh one.
      </p>
      <Link href="/">
        <Button variant="primary">Back to the platform</Button>
      </Link>
    </motion.div>
  );
}
