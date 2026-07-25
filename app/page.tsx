import { moduleOrder, modules } from "@/lib/modules";
import ModuleCard from "@/components/ModuleCard";
import { Terminal, Code2 } from "lucide-react";

export default function Home() {
  const allModules = moduleOrder.map((id) => modules[id as keyof typeof modules]).filter(Boolean);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-10 text-center sm:text-left">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">42 Piscine Curriculum</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Master C programming through the legendary 42 School Piscine. 13 modules, from shell scripting to
          advanced memory management. Write code in your browser and run it instantly.
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="h-5 w-5 text-emerald-500" />
          <h2 className="text-xl font-semibold">Shell Modules</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {allModules
            .filter((m) => m.type === "shell")
            .map((mod) => (
              <ModuleCard key={mod.id} moduleId={mod.id} />
            ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Code2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">C Modules</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allModules
            .filter((m) => m.type === "c")
            .map((mod) => (
              <ModuleCard key={mod.id} moduleId={mod.id} />
            ))}
        </div>
      </div>
    </div>
  );
}
