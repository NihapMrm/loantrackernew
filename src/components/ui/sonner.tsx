import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2 } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Dark pill above the bottom nav (64px bar + 16px margin + safe area), clear of the status bar
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-center"
      offset={{ bottom: 24 }}
      mobileOffset={{ bottom: "calc(max(1rem, env(safe-area-inset-bottom)) + 76px)", left: 16, right: 16 }}
      gap={8}
      visibleToasts={3}
      icons={{
        success: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
        error: <XCircle className="w-5 h-5 text-rose-400" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
        info: <Info className="w-5 h-5 text-sky-400" />,
        loading: <Loader2 className="w-5 h-5 animate-spin opacity-70" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "w-full flex items-center gap-3 rounded-2xl bg-foreground text-background px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.25)] overflow-hidden " +
            // Toasts stacked behind the front one show only their edge, not their text
            "[&[data-front=false][data-expanded=false]>*]:opacity-0",
          icon: "shrink-0 flex items-center",
          content: "flex-1 min-w-0",
          title: "text-sm font-semibold leading-snug",
          description: "text-xs text-background/60 mt-0.5 leading-snug",
          actionButton:
            "shrink-0 rounded-xl bg-background/10 px-3 py-1.5 text-xs font-bold text-emerald-400 active:bg-background/20",
          cancelButton: "shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-background/60",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
