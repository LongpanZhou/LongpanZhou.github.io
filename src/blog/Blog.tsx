import PageShell from '../components/PageShell';
import DrawFrame from '../components/DrawFrame';
import './blog.css';

function Blog() {
  return (
    <PageShell>
      <DrawFrame>
        <div className="blog-page">
          <h1 className="blog-page__title" data-draw="blog.title" data-draw-kind="tower">Blog</h1>
          <div className="blog-page__empty target-lock" data-draw="blog.list" data-draw-kind="nexus">
            <span className="blog-page__empty-icon">&#x2692;</span>
            <p className="blog-page__empty-heading">Under Construction</p>
            <p className="blog-page__empty-sub">Blog posts are on the way. Check back soon.</p>
          </div>
        </div>
      </DrawFrame>
    </PageShell>
  );
}

export default Blog;
