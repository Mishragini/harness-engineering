import { cn } from "@/lib/utils";
import "./App.css";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useHarnessSocket } from "./hooks/useHarnessSocket";
import { useTheme } from "./hooks/useTheme";
import { Moon, Sun } from "lucide-react";
import { TaskPane } from "./components/TaskPane";
import { InspectorPane } from "./components/InvestigatorPane";

function App() {
  const { events, connected, send, clearEvents } = useHarnessSocket();
  const { theme, toggle } = useTheme();
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-sm font-semibold tracking-tight">
            Harness<span className="text-muted-foreground"> Inspector</span>
          </span>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs",
                connected ? "text-emerald-600" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  connected ? "bg-emerald-500" : "bg-muted-foreground/50",
                )}
              />
              {connected ? "connected" : "disconnected"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={toggle}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </Button>
          </div>
        </header>
        <main className="grid min-h-0 flex-1 grid-cols-2">
          <TaskPane events={events} send={send} clearEvents={clearEvents} />
          <InspectorPane events={events} />
        </main>
      </div>
    </TooltipProvider>
  );
}

export default App;
