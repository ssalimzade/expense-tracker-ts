import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * A tab that fails to load (its code is fetched on demand) would otherwise take
 * the whole page down with it. This keeps the app up and offers a reload, which
 * is what fixes the usual cause: a page left open across a deploy.
 */
export default class TabErrorBoundary extends Component<
  { children: ReactNode; /** Remounts the boundary when the tab changes. */ resetKey: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Tab failed to render", error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
        <p className="text-lg font-extrabold tracking-tight">This tab didn&apos;t load</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Usually a connection hiccup. Reloading the page picks it up again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Reload
        </button>
      </div>
    );
  }
}
