import { Link } from "wouter";
import { User, ShieldHalf, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-950 p-6 pt-12">
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full gap-8">
        
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg shadow-primary/30">
            <ShieldHalf size={32} />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">U Scout</h1>
          <p className="text-muted-foreground text-lg">Next-generation basketball profiling.</p>
        </div>

        <div className="space-y-4">
          <Link href="/coach">
            <Card className="hover-elevate cursor-pointer border-transparent shadow-md hover:shadow-lg transition-all active:scale-[0.98] group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 text-accent flex items-center justify-center">
                  <ShieldHalf size={24} />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-accent transition-colors">Coach Mode</h2>
                  <p className="text-sm text-muted-foreground">Scout players and generate game plans</p>
                </div>
                <ChevronRight className="text-slate-300 group-hover:text-accent transition-colors" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/player">
            <Card className="hover-elevate cursor-pointer border-transparent shadow-md hover:shadow-lg transition-all active:scale-[0.98] group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-primary flex items-center justify-center">
                  <User size={24} />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">Player Mode</h2>
                  <p className="text-sm text-muted-foreground">View scouting reports and matchups</p>
                </div>
                <ChevronRight className="text-slate-300 group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </Link>
        </div>

      </div>
    </div>
  );
}