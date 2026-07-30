import { Component, ReactNode } from "react";

/**
 * Without this, an uncaught render error unmounts the entire React tree with
 * zero visible feedback — the splash screen in index.html fades out on a
 * blind timer regardless of mount success, so the user is left staring at a
 * bare background. This catches that instead and offers a way out.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    console.error("Lumen crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="font-display text-2xl text-foreground">Algo deu errado.</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Recarregue a página. Se continuar acontecendo, seus dados estão salvos na nuvem — nada foi perdido.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant"
        >
          Recarregar
        </button>
      </div>
    );
  }
}
