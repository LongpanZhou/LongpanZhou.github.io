import { Component } from 'react'
import type { ReactNode } from 'react'

/**
 * Catches a model that cannot be loaded or drawn (a file missing from the model pack, a bad link, a broken
 * download), so that one entity goes missing instead of the whole page going blank. The entity keeps its
 * place and its editor box, so it can still be deleted.
 */
export default class ModelBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.warn(`The model of "${this.props.name}" could not be shown:`, error instanceof Error ? error.message : error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
