"use client";

import { Card, Badge } from "@heroui/react";
import { ChevronRight, Terminal, Code2 } from "lucide-react";
import Link from "next/link";
import { modules, moduleOrder } from "@/lib/modules";

export default function ModuleCard({ moduleId }: { moduleId: string }) {
  const mod = modules[moduleId as keyof typeof modules];
  if (!mod) return null;

  const completedCount = typeof window !== "undefined"
    ? mod.exercises.filter((ex: { id: string }) => localStorage.getItem(`progress:${mod.id}:${ex.id}`) === "done").length
    : 0;

  const total = mod.exercises.length;
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <Link href={`/${mod.id}`} className="block no-underline">
      <Card className="group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 border cursor-pointer">
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary/20">
          {progress > 0 && (
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          )}
        </div>

        <Card.Header className="pb-1">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {mod.type === "shell" ? (
                <Terminal className="h-5 w-5 text-emerald-500" />
              ) : (
                <Code2 className="h-5 w-5 text-primary" />
              )}
              <Card.Title className="text-lg">{mod.title}</Card.Title>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
        </Card.Header>

        <Card.Content>
          <p className="text-sm text-muted-foreground line-clamp-2">{mod.description}</p>
        </Card.Content>

        <div className="px-4 pb-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{total} exercises</span>
          {progress > 0 && (
            <Badge variant="soft" color={progress === 100 ? "success" : "accent"} size="sm">
              {progress}%
            </Badge>
          )}
        </div>
      </Card>
    </Link>
  );
}
