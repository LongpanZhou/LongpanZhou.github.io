import PanelChrome from './PanelChrome';
import './projectsHud.css';

/**
 * What the Blog view shows over the map. The blog has no posts yet, so it is the "under
 * construction" notice, drawn and typed by the HUD agents like the Projects box. It can be dragged
 * and minimized.
 */
export default function BlogHud() {
  return (
    <div className="hud-box rift-doc rift-doc--blog" data-hud-draw="Blog" data-hud-always data-hud-fixed>
      {/* Neither minimize nor close: the box stays open, and can only be dragged */}
      <PanelChrome id="blog-box" label="Blog" noButton />
      <div className="rift-doc__head">
        <h2 className="rift-doc__title" data-hud-type>Blog</h2>
      </div>
      <div className="rift-doc__empty">
        <span className="rift-doc__empty-icon" data-hud-fade>&#x2692;</span>
        <p className="rift-doc__empty-heading" data-hud-type>Under Construction</p>
        <p className="rift-doc__empty-sub" data-hud-type>Blog posts are on the way. Check back soon.</p>
      </div>
    </div>
  );
}
