// src/client/RenderBoundary.tsx
import { Component, type ReactNode } from "react";
export class RenderBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="empty" role="alert">
        <h2>Cette vue n’a pas pu s’afficher.</h2>
        <p>
          Vos données sont conservées. Réessayez ou ouvrez une autre rubrique.
        </p>
        <button onClick={() => this.setState({ failed: false })}>
          Réessayer
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}
