import { Component } from "react";
import ErrorState from "./ErrorState";

/**
 * Catches render/lifecycle errors in the routed page and shows a recoverable
 * message instead of unmounting the whole app to a blank screen. The boundary
 * is remounted on navigation (the <main> element is keyed by route), so it
 * resets automatically when the user moves to another page.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the details in the console for debugging.
    console.error("Market Pulse render error:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          message={this.state.error?.message || "Something went wrong rendering this page."}
          onRetry={this.reset}
        />
      );
    }
    return this.props.children;
  }
}
